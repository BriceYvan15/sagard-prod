import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { randomBytes } from 'crypto'
import { generatePatrolPointBadgeSvg, generatePatrolPointsSheetSvg } from '../patrols/patrol-qr.util'

@Injectable()
export class SitesService {
  constructor(private prisma: PrismaService) {}

  /** Génère un code site auto incrémental basé sur l'année (SIT-YYYY-NNNN) */
  private async nextCode(): Promise<string> {
    const y = new Date().getFullYear()
    const prefix = `SIT-${y}-`
    const last = await this.prisma.site.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    })
    const n = last?.code ? parseInt(last.code.slice(prefix.length), 10) + 1 : 1
    return `${prefix}${String(n).padStart(4, '0')}`
  }

  async findAll(filters?: { clientId?: string; status?: string; siteType?: string; riskLevel?: string }) {
    return this.prisma.site.findMany({
      where: {
        ...(filters?.clientId  && { clientId: filters.clientId }),
        ...(filters?.status    && { status: filters.status as any }),
        ...(filters?.siteType  && { siteType: filters.siteType as any }),
        ...(filters?.riskLevel && { riskLevel: filters.riskLevel as any }),
      },
      include: {
        client:  { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
        deployments: {
          where: { state: 'ACTIF' },
          select: { id: true, role: true, shiftKind: true, agent: { select: { id: true, matricule: true, user: { select: { firstName: true, lastName: true } } } } },
        },
        _count: { select: { deployments: true, patrolPoints: true, contracts: true } },
      },
      orderBy: { name: 'asc' },
    })
  }

  async findOne(id: string) {
    const site = await this.prisma.site.findUnique({
      where: { id },
      include: {
        client:   true,
        contact:  true,
        contracts: { include: { contract: { select: { id: true, reference: true, status: true } } } },
        deployments: {
          where: { state: { in: ['BROUILLON', 'ACTIF'] } },
          include: { agent: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } } },
          orderBy: { startDate: 'desc' },
        },
        patrolPoints: { where: { active: true }, orderBy: { sequence: 'asc' } },
      },
    })
    if (!site) throw new NotFoundException('Site introuvable')
    return site
  }

  async create(data: any) {
    const code = data.code ?? await this.nextCode()
    return this.prisma.site.create({
      data: {
        code,
        name: data.name,
        clientId: data.clientId,
        contactId: data.contactId ?? null,
        address: data.address,
        city: data.city,
        district: data.district ?? null,
        country: data.country ?? "Côte d'Ivoire",
        latitude: data.latitude != null ? Number(data.latitude) : null,
        longitude: data.longitude != null ? Number(data.longitude) : null,
        siteType: (data.siteType ?? 'VILLA') as any,
        surface: data.surface != null ? Number(data.surface) : null,
        riskLevel: (data.riskLevel ?? 'MOYEN') as any,
        nbAgentsRequired: data.nbAgentsRequired != null ? Number(data.nbAgentsRequired) : 1,
        nbShifts: (data.nbShifts ?? 'ONE') as any,
        hasArmed: !!data.hasArmed,
        hasCanine: !!data.hasCanine,
        status: (data.status ?? 'ACTIF') as any,
        instructions: data.instructions ?? null,
        notes: data.notes ?? null,
      },
    })
  }

  async update(id: string, data: any) {
    await this.findOne(id)
    const patch: any = { ...data }
    if (patch.latitude  != null) patch.latitude  = Number(patch.latitude)
    if (patch.longitude != null) patch.longitude = Number(patch.longitude)
    if (patch.surface   != null) patch.surface   = Number(patch.surface)
    if (patch.nbAgentsRequired != null) patch.nbAgentsRequired = Number(patch.nbAgentsRequired)
    return this.prisma.site.update({ where: { id }, data: patch })
  }

  async deactivate(id: string) {
    await this.findOne(id)
    return this.prisma.site.update({
      where: { id },
      data: { status: 'INACTIF' as any },
    })
  }

  /** Affectation d'un agent : crée un AgentDeployment en BROUILLON (à activer ensuite) */
  async assignAgent(
    siteId: string,
    body: { agentId: string; shift?: string; shiftKind?: string; role?: string; contractId?: string; startDate?: string; endDate?: string; notes?: string; assignedBy?: string }
  ) {
    await this.findOne(siteId)
    // Un gardien ne peut être affecté qu'à UN SEUL site à la fois (ni doublon, ni multi-site)
    const existingActive = await this.prisma.agentDeployment.findFirst({
      where: { agentId: body.agentId, state: 'ACTIF' },
      include: { site: { select: { name: true } } },
    })
    if (existingActive) {
      throw new BadRequestException(
        existingActive.siteId === siteId
          ? 'Ce gardien est déjà affecté à ce site.'
          : `Ce gardien est déjà affecté au site « ${existingActive.site?.name ?? 'un autre site'} ». Retirez-le d'abord avant de le réaffecter.`,
      )
    }
    const ref = `DEP-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`
    return this.prisma.agentDeployment.create({
      data: {
        reference: ref,
        siteId,
        agentId: body.agentId,
        contractId: body.contractId ?? null,
        shift: (body.shift ?? 'JOUR') as any,
        shiftKind: (body.shiftKind ?? body.shift ?? 'JOUR') as any,
        role: (body.role ?? 'AGENT') as any,
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        endDate: body.endDate ? new Date(body.endDate) : null,
        state: 'ACTIF',
        isActive: true,
        assignedBy: body.assignedBy ?? null,
        notes: body.notes ?? null,
      },
    })
  }

  async removeAgent(siteId: string, agentId: string) {
    return this.prisma.agentDeployment.updateMany({
      where: { siteId, agentId, state: 'ACTIF' },
      data: { state: 'TERMINE', isActive: false, endDate: new Date() },
    })
  }

  async getTodayPointages(siteId: string) {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return this.prisma.pointage.findMany({
      where: { siteId, date: today },
      include: { agent: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } } },
      orderBy: { checkInTime: 'desc' },
    })
  }

  // ─── Points de contrôle de ronde (QR) ──────────────────────────────
  async listPatrolPoints(siteId: string) {
    await this.findOne(siteId)
    return this.prisma.patrolPoint.findMany({ where: { siteId }, orderBy: { sequence: 'asc' } })
  }

  async addPatrolPoint(siteId: string, body: { name: string; sequence?: number; locationDescription?: string; latitude?: number; longitude?: number; expectedIntervalMin?: number; instructions?: string }) {
    await this.findOne(siteId)
    const code = randomBytes(6).toString('hex').toUpperCase()
    return this.prisma.patrolPoint.create({
      data: {
        siteId,
        name: body.name,
        code,
        sequence: body.sequence ?? 10,
        locationDescription: body.locationDescription ?? null,
        latitude: body.latitude != null ? Number(body.latitude) : null,
        longitude: body.longitude != null ? Number(body.longitude) : null,
        expectedIntervalMin: body.expectedIntervalMin ?? 60,
        instructions: body.instructions ?? null,
      },
    })
  }

  async removePatrolPoint(pointId: string) {
    return this.prisma.patrolPoint.update({ where: { id: pointId }, data: { active: false } })
  }

  // ─── QR de marque « Badge sombre premium » ─────────────────────────
  /** Renvoie le badge QR (SVG) d'un point de contrôle + ses métadonnées. */
  async getPatrolPointQr(pointId: string) {
    const point = await this.prisma.patrolPoint.findUnique({
      where: { id: pointId },
      include: { site: { select: { name: true } } },
    })
    if (!point) throw new NotFoundException('Point de contrôle introuvable')
    const svg = generatePatrolPointBadgeSvg({
      code: point.code,
      name: point.name,
      siteName: point.site?.name,
      sequence: point.sequence,
    })
    return {
      pointId: point.id,
      code: point.code,
      name: point.name,
      siteName: point.site?.name ?? null,
      sequence: point.sequence,
      svg,
    }
  }

  /** Planche imprimable (SVG A4) de tous les points actifs d'un site. */
  async getPatrolPointsQrSheet(siteId: string) {
    const site = await this.findOne(siteId)
    const points = await this.prisma.patrolPoint.findMany({
      where: { siteId, active: true },
      orderBy: { sequence: 'asc' },
    })
    if (points.length === 0) throw new NotFoundException('Aucun point de contrôle actif pour ce site')
    const svg = generatePatrolPointsSheetSvg(
      points.map(p => ({ code: p.code, name: p.name, siteName: site.name, sequence: p.sequence })),
      site.name,
    )
    return { siteId, siteName: site.name, count: points.length, svg }
  }
}

