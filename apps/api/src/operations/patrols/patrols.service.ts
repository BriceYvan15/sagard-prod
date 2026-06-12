import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { randomBytes } from 'crypto'

/**
 * Rondes d'agent — équivalent Odoo sagard.patrol.round + sagard.patrol.check.
 * Un agent démarre une ronde sur un site, scanne les QR codes des PatrolPoint,
 * la ronde est complétée à >=80% de points, sinon incomplète.
 */
@Injectable()
export class PatrolsService {
  constructor(private prisma: PrismaService) {}

  private nextRef(): string {
    return `RND-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`
  }

  async findAll(filters?: { siteId?: string; agentId?: string; state?: string; from?: string; to?: string }) {
    return this.prisma.patrolRound.findMany({
      where: {
        ...(filters?.siteId  && { siteId: filters.siteId }),
        ...(filters?.agentId && { agentId: filters.agentId }),
        ...(filters?.state   && { state: filters.state as any }),
        ...(filters?.from || filters?.to ? {
          dateStart: {
            ...(filters.from && { gte: new Date(filters.from) }),
            ...(filters.to   && { lte: new Date(filters.to) }),
          },
        } : {}),
      },
      include: {
        site:  { select: { id: true, name: true, code: true } },
        agent: { include: { user: { select: { firstName: true, lastName: true } } } },
        _count: { select: { checks: true } },
      },
      orderBy: { dateStart: 'desc' },
      take: 200,
    })
  }

  async findOne(id: string) {
    const r = await this.prisma.patrolRound.findUnique({
      where: { id },
      include: {
        site: { include: { patrolPoints: { where: { active: true }, orderBy: { sequence: 'asc' } } } },
        agent: { include: { user: true } },
        checks: { include: { point: true }, orderBy: { checkTime: 'asc' } },
      },
    })
    if (!r) throw new NotFoundException('Ronde introuvable')
    return r
  }

  /** Démarre une nouvelle ronde sur un site par un agent */
  async start(body: { siteId: string; agentId: string; notes?: string }) {
    const pointsTotal = await this.prisma.patrolPoint.count({
      where: { siteId: body.siteId, active: true },
    })
    return this.prisma.patrolRound.create({
      data: {
        reference: this.nextRef(),
        siteId: body.siteId,
        agentId: body.agentId,
        dateStart: new Date(),
        state: 'EN_COURS',
        pointsTotal,
        pointsDone: 0,
        completionPct: 0,
        notes: body.notes ?? null,
      },
    })
  }

  /** Scanner un point (QR/NFC) pendant la ronde */
  async scan(roundId: string, body: { pointCode?: string; pointId?: string; latitude?: number; longitude?: number; photoUrl?: string; note?: string; hasAnomaly?: boolean }) {
    const round = await this.findOne(roundId)
    if (round.state !== 'EN_COURS') {
      throw new BadRequestException('Cette ronde n\'est plus en cours.')
    }

    // Résolution du point par code ou par id
    let pointId = body.pointId ?? null
    if (!pointId && body.pointCode) {
      const pt = await this.prisma.patrolPoint.findUnique({ where: { code: body.pointCode } })
      if (pt && pt.siteId === round.siteId) pointId = pt.id
    }

    const check = await this.prisma.patrolCheck.create({
      data: {
        roundId,
        pointId,
        pointCode: body.pointCode ?? null,
        checkTime: new Date(),
        latitude: body.latitude != null ? Number(body.latitude) : null,
        longitude: body.longitude != null ? Number(body.longitude) : null,
        photoUrl: body.photoUrl ?? null,
        note: body.note ?? null,
        hasAnomaly: !!body.hasAnomaly,
      },
    })

    // Mise à jour des compteurs (sur points valides uniquement)
    const done = await this.prisma.patrolCheck.count({
      where: { roundId, pointId: { not: null } },
    })
    const pct = round.pointsTotal > 0 ? (done / round.pointsTotal) * 100 : 0
    await this.prisma.patrolRound.update({
      where: { id: roundId },
      data: { pointsDone: done, completionPct: Math.round(pct * 100) / 100 },
    })

    return check
  }

  /** Termine la ronde : complétée si >=80%, sinon incomplète */
  async complete(id: string) {
    const r = await this.findOne(id)
    const newState = r.completionPct >= 80 ? 'TERMINEE' : 'INCOMPLETE'
    const end = new Date()
    const duration = (end.getTime() - new Date(r.dateStart).getTime()) / 60000
    return this.prisma.patrolRound.update({
      where: { id },
      data: { state: newState as any, dateEnd: end, durationMin: Math.round(duration * 100) / 100 },
    })
  }

  async abort(id: string) {
    return this.prisma.patrolRound.update({
      where: { id },
      data: { state: 'INTERROMPUE', dateEnd: new Date() },
    })
  }
}

