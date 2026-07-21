import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsService } from '../../notifications/notifications.service'
import { randomBytes } from 'crypto'

/**
 * Visites de contrôle terrain — équivalent Odoo sagard.control.visit.
 * Workflow : BROUILLON → EFFECTUEE / REPORTEE / ANNULEE
 */
@Injectable()
export class ControlsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private nextRef(): string {
    return `CTRL-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`
  }

  async findAll(filters?: { siteId?: string; controllerId?: string; state?: string; visitType?: string; from?: string; to?: string }) {
    const controls = await this.prisma.controllerPatrol.findMany({
      where: {
        ...(filters?.siteId       && { siteId: filters.siteId }),
        ...(filters?.controllerId && { controllerId: filters.controllerId }),
        ...(filters?.state        && { state: filters.state as any }),
        ...(filters?.visitType    && { visitType: filters.visitType as any }),
        ...(filters?.from || filters?.to ? {
          visitDatetime: {
            ...(filters.from && { gte: new Date(filters.from) }),
            ...(filters.to   && { lte: new Date(filters.to) }),
          },
        } : {}),
      },
      include: {
        site: { select: { id: true, name: true, code: true, city: true } },
        _count: { select: { incidents: true, agentChecks: true } },
      },
      orderBy: { visitDatetime: 'desc' },
      take: 200,
    })
    const controllerIds = [...new Set(controls.map(c => c.controllerId).filter(Boolean))] as string[]
    const users = controllerIds.length > 0
      ? await this.prisma.user.findMany({ where: { id: { in: controllerIds } }, select: { id: true, firstName: true, lastName: true, role: true } })
      : []
    const userMap = new Map(users.map(u => [u.id, u]))
    return controls.map(c => ({ ...c, controller: userMap.get(c.controllerId) ?? null }))
  }

  async findOne(id: string) {
    const v = await this.prisma.controllerPatrol.findUnique({
      where: { id },
      include: {
        site: true,
        agentChecks: true,
        incidents: true,
      },
    })
    if (!v) throw new NotFoundException('Visite de contrôle introuvable')
    const controller = v.controllerId
      ? await this.prisma.user.findUnique({ where: { id: v.controllerId }, select: { id: true, firstName: true, lastName: true, role: true, email: true } })
      : null
    return { ...v, controller }
  }

  async create(data: any) {
    const control = await this.prisma.controllerPatrol.create({
      data: {
        reference:     data.reference ?? this.nextRef(),
        controllerId:  data.controllerId,
        siteId:        data.siteId,
        contractId:    data.contractId ?? null,
        visitDatetime: data.visitDatetime ? new Date(data.visitDatetime) : new Date(),
        visitType:     (data.visitType ?? 'ROUTINE') as any,
        agentsExpected: data.agentsExpected != null ? Number(data.agentsExpected) : 0,
        observations:  data.observations ?? null,
        notes:         data.notes ?? null,
        state:         'BROUILLON',
      },
    })

    // Notifier le chef des opérations et le DG
    const site = await this.prisma.site.findUnique({ where: { id: data.siteId }, select: { name: true } })
    let creatorName = 'Un contrôleur'
    if (data.controllerId) {
      const creator = await this.prisma.user.findUnique({ where: { id: data.controllerId }, select: { firstName: true, lastName: true } })
      if (creator) creatorName = `${creator.firstName} ${creator.lastName}`
    }
    this.notifications.notifyNewControlVisit(control, site?.name ?? 'inconnu', creatorName).catch(() => {})

    return control
  }

  async update(id: string, data: any) {
    await this.findOne(id)
    const patch: any = { ...data }
    if (patch.arrivedAt) patch.arrivedAt = new Date(patch.arrivedAt)
    if (patch.leftAt)    patch.leftAt    = new Date(patch.leftAt)
    if (patch.arrivedAt && patch.leftAt) {
      const dur = (new Date(patch.leftAt).getTime() - new Date(patch.arrivedAt).getTime()) / 60000
      patch.durationMinutes = Math.round(dur)
    }
    if (patch.agentsExpected != null) patch.agentsExpected = Number(patch.agentsExpected)
    if (patch.agentsChecked  != null) patch.agentsChecked  = Number(patch.agentsChecked)
    if (patch.rating         != null) patch.rating         = Number(patch.rating)
    return this.prisma.controllerPatrol.update({ where: { id }, data: patch })
  }

  async markDone(id: string)     { return this.prisma.controllerPatrol.update({ where: { id }, data: { state: 'EFFECTUEE', leftAt: new Date() } }) }
  async markReported(id: string) { return this.prisma.controllerPatrol.update({ where: { id }, data: { state: 'REPORTEE' } }) }
  async cancel(id: string)       { return this.prisma.controllerPatrol.update({ where: { id }, data: { state: 'ANNULEE' } }) }
}
