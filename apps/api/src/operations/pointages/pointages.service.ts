import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsService } from '../../notifications/notifications.service'
import { CheckInDto } from './dto/check-in.dto'
import { CheckOutDto } from './dto/check-out.dto'

@Injectable()
export class PointagesService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async checkIn(agentId: string, dto: CheckInDto & { contractId?: string; deploymentId?: string; controllerId?: string; pointingMethod?: string }) {
    // Vérifier que l'agent existe
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } })
    if (!agent) throw new BadRequestException('Agent introuvable. Votre compte n\'est pas lié à un agent actif.')

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const existing = await this.prisma.pointage.findFirst({
      where: { agentId, date: today, shift: dto.shift as any, status: { in: ['EN_COURS', 'PRESENT', 'RETARD'] as any } },
    })
    if (existing) throw new BadRequestException('Un pointage est déjà en cours pour cette vacation')
    // photoUrl is now optional - GPS-only pointage supported

    // Auto-link au déploiement actif si non fourni
    let deploymentId = dto.deploymentId ?? null
    let siteId = dto.siteId
    let contractId = dto.contractId ?? null
    if (!deploymentId) {
      const dep = await this.prisma.agentDeployment.findFirst({
        where: {
          agentId, state: 'ACTIF',
          startDate: { lte: today },
          OR: [{ endDate: null }, { endDate: { gte: today } }],
        },
        select: { id: true, siteId: true, contractId: true },
      })
      if (dep) { deploymentId = dep.id; siteId = siteId ?? dep.siteId; contractId = contractId ?? dep.contractId }
    }

    // Bloquer le pointage si aucune affectation active
    if (!deploymentId) {
      throw new BadRequestException('Aucune affectation active trouvée. Vous devez être affecté à un site pour pointer.')
    }

    const now = new Date()
    const lateMin = this.computeLateMinutes(dto.shift, now)
    const isLate = lateMin > 0

    const pointage = await this.prisma.pointage.create({
      data: {
        agentId,
        siteId: siteId ?? null,
        contractId,
        deploymentId,
        controllerId: dto.controllerId ?? null,
        date: today,
        checkInTime: now,
        checkInPhoto: dto.photoUrl || null,
        checkInLat: dto.latitude,
        checkInLng: dto.longitude,
        shift: dto.shift as any,
        pointingMethod: (dto.pointingMethod ?? 'CONTROLEUR') as any,
        status: isLate ? 'RETARD' : 'EN_COURS',
        lateMinutes: lateMin,
        notes: dto.notes,
      },
      include: { agent: { include: { user: true } } },
    })

    if (isLate) await this.notifications.notifyLateCheckin(pointage)
    return pointage
  }

  async checkOut(agentId: string, pointageId: string, dto: CheckOutDto) {
    const pointage = await this.prisma.pointage.findUnique({
      where: { id: pointageId },
      include: { agent: { include: { user: true } } },
    })

    if (!pointage) throw new BadRequestException('Pointage introuvable')
    if (pointage.agentId !== agentId) throw new ForbiddenException()
    if (pointage.status === 'TERMINE') throw new BadRequestException('Pointage déjà terminé')
    // photoUrl is now optional - GPS-only checkout supported

    const now = new Date()
    const hoursWorked = pointage.checkInTime
      ? Math.round(((now.getTime() - new Date(pointage.checkInTime).getTime()) / 3600000) * 100) / 100
      : 0
    // Heures normales d'une vacation : 12h. Au-delà = heures supp.
    const overtime = Math.max(0, hoursWorked - 12)

    return this.prisma.pointage.update({
      where: { id: pointageId },
      data: {
        checkOutTime: now,
        checkOutPhoto: dto.photoUrl,
        checkOutLat: dto.latitude,
        checkOutLng: dto.longitude,
        hoursWorked,
        overtimeHours: Math.round(overtime * 100) / 100,
        status: 'TERMINE',
      },
    })
  }

  /** Mise à jour position GPS en cours de poste (tracking horaire) */
  async updatePosition(agentId: string, pointageId: string, dto: { latitude?: number; longitude?: number }) {
    const pointage = await this.prisma.pointage.findUnique({ where: { id: pointageId } })
    if (!pointage) throw new BadRequestException('Pointage introuvable')
    if (pointage.agentId !== agentId) throw new ForbiddenException()
    if (pointage.status === 'TERMINE') throw new BadRequestException('Pointage déjà terminé')

    return this.prisma.pointage.update({
      where: { id: pointageId },
      data: {
        currentLat: dto.latitude ?? null,
        currentLng: dto.longitude ?? null,
        lastPositionAt: new Date(),
      },
    })
  }

  /** Génère les lignes de pointage du jour à partir des déploiements actifs (cron quotidien) */
  async generateDailyAttendance(date?: Date) {
    const target = date ?? new Date()
    target.setHours(0, 0, 0, 0)
    const deployments = await this.prisma.agentDeployment.findMany({
      where: {
        state: 'ACTIF',
        startDate: { lte: target },
        OR: [{ endDate: null }, { endDate: { gte: target } }],
      },
    })
    let created = 0
    for (const d of deployments) {
      const shift: any = d.shiftKind === 'NUIT' ? 'NUIT' : 'JOUR'
      const exists = await this.prisma.pointage.findFirst({
        where: { agentId: d.agentId, date: target, shift },
      })
      if (exists) continue
      await this.prisma.pointage.create({
        data: {
          agentId: d.agentId,
          siteId: d.siteId,
          contractId: d.contractId,
          deploymentId: d.id,
          date: target,
          shift,
          pointingMethod: 'CONTROLEUR' as any,
          status: 'ABSENT',
        },
      })
      created++
    }
    return { created, target }
  }

  async getTodayPointages(filters?: { siteId?: string; shift?: string }) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return this.prisma.pointage.findMany({
      where: {
        date: today,
        ...(filters?.siteId && { siteId: filters.siteId }),
        ...(filters?.shift && { shift: filters.shift as any }),
      },
      include: {
        agent: {
          select: { id: true, matricule: true, shift: true, user: { select: { firstName: true, lastName: true, phone: true, photoUrl: true } } },
        },
        deployment: { select: { id: true, reference: true, site: { select: { id: true, name: true, code: true, latitude: true, longitude: true, address: true, district: true } } } },
      },
      orderBy: { checkInTime: 'desc' },
    })
  }

  async getPointagesByDate(date: Date, filters?: { siteId?: string; shift?: string }) {
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)

    return this.prisma.pointage.findMany({
      where: {
        date: dayStart,
        ...(filters?.siteId && { siteId: filters.siteId }),
        ...(filters?.shift && { shift: filters.shift as any }),
      },
      include: {
        agent: {
          select: { id: true, matricule: true, shift: true, user: { select: { firstName: true, lastName: true, phone: true, photoUrl: true } } },
        },
        deployment: { select: { id: true, reference: true, site: { select: { id: true, name: true, code: true, latitude: true, longitude: true, address: true, district: true } } } },
      },
      orderBy: { checkInTime: 'desc' },
    })
  }

  async getAgentPointages(agentId: string, startDate: Date, endDate: Date) {
    return this.prisma.pointage.findMany({
      where: {
        agentId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'desc' },
    })
  }

  async getDailyReport(date: Date, siteId?: string) {
    const dayStart = new Date(date)
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date(date)
    dayEnd.setHours(23, 59, 59, 999)

    const pointages = await this.prisma.pointage.findMany({
      where: {
        date: dayStart,
        ...(siteId && { siteId }),
      },
      include: {
        agent: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    })

    const stats = {
      total: pointages.length,
      enCours: pointages.filter(p => p.status === 'EN_COURS').length,
      termines: pointages.filter(p => p.status === 'TERMINE').length,
      retards: pointages.filter(p => p.status === 'RETARD').length,
      absents: pointages.filter(p => p.status === 'ABSENT').length,
    }

    return { date, stats, pointages }
  }

  /** Renvoie les minutes de retard (au-delà de 15min de tolérance), 0 si à l'heure. */
  private computeLateMinutes(shift: string, checkInTime: Date): number {
    const actual = checkInTime.getHours() * 60 + checkInTime.getMinutes()
    const graceMinutes = 15
    const expected = shift === 'NUIT' ? 18 * 60 + 30 : 6 * 60 + 30 // 18h30 ou 6h30
    const delta = actual - (expected + graceMinutes)
    return delta > 0 ? delta : 0
  }
}
