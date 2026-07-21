import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsService } from '../../notifications/notifications.service'
import { randomBytes } from 'crypto'

/**
 * Incidents de sécurité — équivalent Odoo sagard.incident.
 * Workflow : OUVERT → INVESTIGATION → RESOLU → CLOS
 */
@Injectable()
export class IncidentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private nextRef(): string {
    return `INC-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`
  }

  async findAll(filters?: { siteId?: string; state?: string; severity?: string; incidentType?: string; from?: string; to?: string }) {
    const incidents = await this.prisma.incident.findMany({
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
    const reporterIds = [...new Set(incidents.map(i => i.reporterId).filter(Boolean))] as string[]
    const users = reporterIds.length > 0
      ? await this.prisma.user.findMany({ where: { id: { in: reporterIds } }, select: { id: true, firstName: true, lastName: true, role: true } })
      : []
    const userMap = new Map(users.map(u => [u.id, u]))
    return incidents.map(i => ({ ...i, reporter: i.reporterId ? userMap.get(i.reporterId) ?? null : null }))
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
        opsReportBy: { select: { id: true, firstName: true, lastName: true, role: true } },
        opsReportValidatedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    })
    if (!inc) throw new NotFoundException('Incident introuvable')
    let reporter = null
    if (inc.reporterId) {
      reporter = await this.prisma.user.findUnique({ where: { id: inc.reporterId }, select: { id: true, firstName: true, lastName: true, role: true, email: true } })
    }
    return { ...inc, reporter }
  }

  async create(data: any) {
    const incident = await this.prisma.incident.create({
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

    // Notifier le chef des opérations et le DG
    const site = await this.prisma.site.findUnique({ where: { id: data.siteId }, select: { name: true } })
    let creatorName = 'Un utilisateur'
    if (data.reporterId) {
      const creator = await this.prisma.user.findUnique({ where: { id: data.reporterId }, select: { firstName: true, lastName: true } })
      if (creator) creatorName = `${creator.firstName} ${creator.lastName}`
    }
    this.notifications.notifyNewIncident(incident, site?.name ?? 'inconnu', creatorName).catch(() => {})

    return incident
  }

  async update(id: string, data: any) {
    await this.findOne(id)
    const patch: any = { ...data }
    if (patch.incidentDatetime) patch.incidentDatetime = new Date(patch.incidentDatetime)
    if (patch.estimatedDamage != null) patch.estimatedDamage = Number(patch.estimatedDamage)
    return this.prisma.incident.update({ where: { id }, data: patch })
  }

  async updatePhoto(id: string, photoUrl: string) {
    await this.findOne(id)
    return this.prisma.incident.update({
      where: { id },
      data: { attachmentUrls: { push: photoUrl } },
    })
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

  // ─── Rapport d'incident par le chef des opérations ────────────────
  async submitOpsReport(id: string, report: string, userId: string) {
    const inc = await this.findOne(id)
    if (!report.trim()) throw new BadRequestException('Le rapport ne peut pas être vide.')
    const updated = await this.prisma.incident.update({
      where: { id },
      data: {
        opsReport: report.trim(),
        opsReportDate: new Date(),
        opsReportById: userId,
        opsReportState: 'SOUMIS',
      },
    })

    // Notifier tous les DG
    const dgs = await this.prisma.user.findMany({
      where: { role: 'DIRECTEUR_GENERAL', status: 'ACTIF' },
      select: { id: true },
    })
    if (dgs.length > 0) {
      await this.prisma.notification.createMany({
        data: dgs.map(dg => ({
          userId: dg.id,
          type: 'INCIDENT',
          title: `Rapport d'incident — ${inc.reference}`,
          message: `Le chef des opérations a soumis un rapport pour l'incident "${inc.title}".`,
          channel: 'IN_APP',
          data: { incidentId: id, opsReportState: 'SOUMIS' },
        })),
      })
    }

    return updated
  }

  async validateOpsReport(id: string, userId: string) {
    await this.findOne(id)
    return this.prisma.incident.update({
      where: { id },
      data: {
        opsReportState: 'VALIDE',
        opsReportValidatedById: userId,
        opsReportValidatedAt: new Date(),
      },
    })
  }

  async rejectOpsReport(id: string, userId: string, reason?: string) {
    const inc = await this.findOne(id)
    return this.prisma.incident.update({
      where: { id },
      data: {
        opsReportState: 'REJETE',
        opsReportValidatedById: userId,
        opsReportValidatedAt: new Date(),
        ...(reason && { opsReport: `${inc.opsReport ?? ''}\n\n--- Motif de rejet: ${reason}` }),
      },
    })
  }
}
