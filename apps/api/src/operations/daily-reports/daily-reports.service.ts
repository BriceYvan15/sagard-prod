import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { randomBytes } from 'crypto'

/**
 * Rapports quotidiens de site — équivalent Odoo sagard.daily.report.
 * Workflow : BROUILLON → SOUMIS → VALIDE / REJETE
 */
@Injectable()
export class DailyReportsService {
  constructor(private prisma: PrismaService) {}

  private nextRef(): string {
    return `RPT-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`
  }

  async findAll(filters?: { siteId?: string; state?: string; from?: string; to?: string }) {
    return this.prisma.dailyReport.findMany({
      where: {
        ...(filters?.siteId && { siteId: filters.siteId }),
        ...(filters?.state  && { state: filters.state as any }),
        ...(filters?.from || filters?.to ? {
          date: {
            ...(filters.from && { gte: new Date(filters.from) }),
            ...(filters.to   && { lte: new Date(filters.to) }),
          },
        } : {}),
      },
      include: {
        site: { select: { id: true, name: true, code: true } },
        _count: { select: { incidents: true, agents: true } },
      },
      orderBy: { date: 'desc' },
      take: 200,
    })
  }

  async findOne(id: string) {
    const r = await this.prisma.dailyReport.findUnique({
      where: { id },
      include: {
        site: true,
        agents: true,
        incidents: { orderBy: { incidentDatetime: 'desc' } },
      },
    })
    if (!r) throw new NotFoundException('Rapport quotidien introuvable')
    return r
  }

  async create(data: any) {
    const date = data.date ? new Date(data.date) : new Date()
    date.setHours(0, 0, 0, 0)
    return this.prisma.dailyReport.create({
      data: {
        reference: this.nextRef(),
        date,
        siteId: data.siteId,
        contractId: data.contractId ?? null,
        shift: (data.shift ?? 'JOUR') as any,
        chiefAgentId: data.chiefAgentId ?? null,
        agentsExpected: data.agentsExpected != null ? Number(data.agentsExpected) : 0,
        agentCount: 0,
        state: 'BROUILLON',
        weather: data.weather ?? null,
        visitorsCount: data.visitorsCount ?? 0,
        vehiclesInCount: data.vehiclesInCount ?? 0,
        vehiclesOutCount: data.vehiclesOutCount ?? 0,
        roundsDone: data.roundsDone ?? 0,
        summary: data.summary ?? null,
        activities: data.activities ?? null,
        handoverTo: data.handoverTo ?? null,
        keysCount: data.keysCount ?? 0,
        nextShiftNotes: data.nextShiftNotes ?? null,
        submittedBy: data.submittedBy ?? null,
      },
    })
  }

  async update(id: string, data: any) {
    const r = await this.findOne(id)
    if (r.state === 'VALIDE') throw new BadRequestException('Un rapport validé ne peut plus être modifié.')
    const patch: any = { ...data }
    if (patch.date) { const d = new Date(patch.date); d.setHours(0,0,0,0); patch.date = d }
    return this.prisma.dailyReport.update({ where: { id }, data: patch })
  }

  // ─── Gestion des agents présents ───────────────────────────────
  async addAgent(reportId: string, agentId: string) {
    await this.prisma.dailyReportAgent.upsert({
      where: { reportId_agentId: { reportId, agentId } },
      update: {},
      create: { reportId, agentId },
    })
    return this.recountAgents(reportId)
  }

  async removeAgent(reportId: string, agentId: string) {
    await this.prisma.dailyReportAgent.deleteMany({ where: { reportId, agentId } })
    return this.recountAgents(reportId)
  }

  private async recountAgents(reportId: string) {
    const count = await this.prisma.dailyReportAgent.count({ where: { reportId } })
    return this.prisma.dailyReport.update({ where: { id: reportId }, data: { agentCount: count } })
  }

  // ─── Workflow ──────────────────────────────────────────────────
  async submit(id: string) {
    const r = await this.findOne(id)
    if (r.state !== 'BROUILLON') throw new BadRequestException('Seul un brouillon peut être soumis.')
    return this.prisma.dailyReport.update({ where: { id }, data: { state: 'SOUMIS' } })
  }

  async validate(id: string, validatorId: string) {
    const r = await this.findOne(id)
    if (r.state !== 'SOUMIS') throw new BadRequestException('Seul un rapport soumis peut être validé.')
    return this.prisma.dailyReport.update({
      where: { id },
      data: { state: 'VALIDE', validatorId, validationDate: new Date() },
    })
  }

  async reject(id: string) {
    return this.prisma.dailyReport.update({ where: { id }, data: { state: 'REJETE' } })
  }

  async reset(id: string) {
    return this.prisma.dailyReport.update({ where: { id }, data: { state: 'BROUILLON' } })
  }
}
