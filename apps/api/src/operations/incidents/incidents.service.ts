import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { randomBytes } from 'crypto'

/**
 * Incidents de sécurité — équivalent Odoo sagard.incident.
 * Workflow : OUVERT → INVESTIGATION → RESOLU → CLOS
 */
@Injectable()
export class IncidentsService {
  constructor(private prisma: PrismaService) {}

  private nextRef(): string {
    return `INC-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`
  }

  async findAll(filters?: { siteId?: string; state?: string; severity?: string; incidentType?: string; from?: string; to?: string }) {
    return this.prisma.incident.findMany({
      where: {
        ...(filters?.siteId       && { siteId: filters.siteId }),
        ...(filters?.state        && { state: filters.state as any }),
        ...(filters?.severity     && { severity: filters.severity as any }),
        ...(filters?.incidentType && { incidentType: filters.incidentType as any }),
        ...(filters?.from || filters?.to ? {
          incidentDatetime: {
            ...(filters.from && { gte: new Date(filters.from) }),
            ...(filters.to   && { lte: new Date(filters.to) }),
          },
        } : {}),
      },
      include: {
        site: { select: { id: true, name: true, code: true } },
        _count: { select: { involvedAgents: true, alerts: true } },
      },
      orderBy: { incidentDatetime: 'desc' },
      take: 200,
    })
  }

  async findOne(id: string) {
    const inc = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        site: true,
        dailyReport: { select: { id: true, reference: true, date: true } },
        controlVisit: { select: { id: true, reference: true } },
        involvedAgents: true,
        alerts: { select: { id: true, reference: true, alertType: true, severity: true } },
      },
    })
    if (!inc) throw new NotFoundException('Incident introuvable')
    return inc
  }

  async create(data: any) {
    return this.prisma.incident.create({
      data: {
        reference: this.nextRef(),
        title: data.title,
        siteId: data.siteId,
        incidentDatetime: data.incidentDatetime ? new Date(data.incidentDatetime) : new Date(),
        incidentType: data.incidentType as any,
        severity: (data.severity ?? 'FAIBLE') as any,
        state: 'OUVERT',
        reporterId: data.reporterId ?? null,
        dailyReportId: data.dailyReportId ?? null,
        controlVisitId: data.controlVisitId ?? null,
        description: data.description ?? '',
        actionsTaken: data.actionsTaken ?? null,
        policeCalled: !!data.policeCalled,
        clientNotified: !!data.clientNotified,
        estimatedDamage: data.estimatedDamage != null ? Number(data.estimatedDamage) : null,
        currency: data.currency ?? 'XOF',
        attachmentUrls: data.attachmentUrls ?? [],
      },
    })
  }

  async update(id: string, data: any) {
    await this.findOne(id)
    const patch: any = { ...data }
    if (patch.incidentDatetime) patch.incidentDatetime = new Date(patch.incidentDatetime)
    if (patch.estimatedDamage != null) patch.estimatedDamage = Number(patch.estimatedDamage)
    return this.prisma.incident.update({ where: { id }, data: patch })
  }

  async investigate(id: string) { return this.prisma.incident.update({ where: { id }, data: { state: 'INVESTIGATION' } }) }
  async resolve(id: string, resolution?: string) {
    return this.prisma.incident.update({ where: { id }, data: { state: 'RESOLU', resolution: resolution ?? null } })
  }
  async close(id: string) { return this.prisma.incident.update({ where: { id }, data: { state: 'CLOS' } }) }

  async addAgent(incidentId: string, agentId: string, role?: string) {
    return this.prisma.incidentAgent.upsert({
      where: { incidentId_agentId: { incidentId, agentId } },
      update: { role: role ?? null },
      create: { incidentId, agentId, role: role ?? null },
    })
  }

  async removeAgent(incidentId: string, agentId: string) {
    return this.prisma.incidentAgent.deleteMany({ where: { incidentId, agentId } })
  }
}
