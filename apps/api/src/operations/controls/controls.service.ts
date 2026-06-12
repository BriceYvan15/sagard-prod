import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { randomBytes } from 'crypto'

/**
 * Visites de contrôle terrain — équivalent Odoo sagard.control.visit.
 * Workflow : BROUILLON → EFFECTUEE / REPORTEE / ANNULEE
 */
@Injectable()
export class ControlsService {
  constructor(private prisma: PrismaService) {}

  private nextRef(): string {
    return `CTRL-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`
  }

  async findAll(filters?: { siteId?: string; controllerId?: string; state?: string; visitType?: string; from?: string; to?: string }) {
    return this.prisma.controllerPatrol.findMany({
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
    return v
  }

  async create(data: any) {
    return this.prisma.controllerPatrol.create({
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
