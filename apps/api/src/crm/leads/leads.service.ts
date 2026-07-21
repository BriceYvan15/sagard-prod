import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationsService } from '../../notifications/notifications.service'

@Injectable()
export class LeadsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async findAll(filters?: { stage?: string; assignedToId?: string; priority?: string; createdById?: string }) {
    const where: any = {}
    if (filters?.stage) where.stage = filters.stage
    if (filters?.assignedToId) where.assignedToId = filters.assignedToId
    if (filters?.priority) where.priority = filters.priority
    if (filters?.createdById) where.createdById = filters.createdById

    return this.prisma.crmLead.findMany({
      where,
      include: {
        client: { select: { id: true, name: true } },
        _count: { select: { activities: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async findOne(id: string) {
    return this.prisma.crmLead.findUniqueOrThrow({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        activities: { orderBy: { date: 'desc' }, take: 30 },
      },
    })
  }

  async create(data: any) {
    const count = await this.prisma.crmLead.count()
    const reference = `LEAD-${String(count + 1).padStart(5, '0')}`

    const lead = await this.prisma.crmLead.create({
      data: {
        reference,
        title: data.title,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        companyName: data.companyName,
        clientId: data.clientId || null,
        assignedToId: data.assignedToId || null,
        source: data.source ?? 'APPEL_ENTRANT',
        priority: data.priority ?? 'NORMALE',
        serviceType: data.serviceType ?? 'GARDIENNAGE_STATIQUE',
        siteAddress: data.siteAddress,
        siteCity: data.siteCity,
        siteSurface: data.siteSurface ? parseFloat(data.siteSurface) : null,
        nbAgentsEstimated: data.nbAgentsEstimated ? parseInt(data.nbAgentsEstimated) : 0,
        nbShifts: data.nbShifts ? parseInt(data.nbShifts) : 1,
        armedRequired: data.armedRequired ?? false,
        canineRequired: data.canineRequired ?? false,
        riskLevel: data.riskLevel ?? 'FAIBLE',
        targetStartDate: data.targetStartDate ? new Date(data.targetStartDate) : null,
        estimatedRevenue: data.estimatedRevenue ?? null,
        notes: data.notes,
        createdById: data.createdById || null,
      },
      include: { client: { select: { id: true, name: true } } },
    })

    // Notify DG of new prospect
    if (data.createdById) {
      const creator = await this.prisma.user.findUnique({ where: { id: data.createdById }, select: { firstName: true, lastName: true } })
      if (creator) {
        this.notifications.notifyNewProspect(lead, `${creator.firstName} ${creator.lastName}`).catch(() => {})
      }
    }

    return lead
  }

  async update(id: string, data: any) {
    return this.prisma.crmLead.update({ where: { id }, data })
  }

  // ── Pipeline transitions ──
  async qualify(id: string) {
    return this.prisma.crmLead.update({
      where: { id },
      data: { stage: 'QUALIFIE', probability: 25 },
    })
  }

  async propose(id: string) {
    return this.prisma.crmLead.update({
      where: { id },
      data: { stage: 'PROPOSITION', probability: 50 },
    })
  }

  async negotiate(id: string) {
    return this.prisma.crmLead.update({
      where: { id },
      data: { stage: 'NEGOCIATION', probability: 75 },
    })
  }

  async win(id: string) {
    return this.prisma.crmLead.update({
      where: { id },
      data: { stage: 'GAGNE', probability: 100, wonDate: new Date() },
    })
  }

  async lose(id: string, reason?: string) {
    return this.prisma.crmLead.update({
      where: { id },
      data: { stage: 'PERDU', probability: 0, lostDate: new Date(), lostReason: reason },
    })
  }

  // ── Conversion Prospect → Client ──
  async convertToClient(leadId: string, clientData: any) {
    const lead = await this.prisma.crmLead.findUniqueOrThrow({ where: { id: leadId } })

    if (lead.clientId) {
      throw new BadRequestException('Ce prospect est déjà lié à un client')
    }

    // Generate client code
    const count = await this.prisma.client.count()
    const code = `CLI-${String(count + 1).padStart(5, '0')}`

    // Helper: empty string → undefined (avoids unique constraint on "")
    const clean = (v: any) => (v && typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined)

    try {
      // Create client + update lead in a transaction
      const [client] = await this.prisma.$transaction([
        this.prisma.client.create({
          data: {
            code,
            name: clientData.name || lead.companyName || lead.contactName || 'Client',
            legalName: clean(clientData.legalName),
            segment: clientData.segment || 'AUTRE',
            sector: clean(clientData.sector),
            taxId: clean(clientData.taxId),
            rccm: clean(clientData.rccm),
            ncc: clean(clientData.ncc),
            phone: clean(clientData.phone) || clean(lead.contactPhone),
            mobile: clean(clientData.mobile),
            email: clean(clientData.email) || clean(lead.contactEmail),
            website: clean(clientData.website),
            address: clientData.address || lead.siteAddress || '',
            street2: clean(clientData.street2),
            zip: clean(clientData.zip),
            city: clientData.city || lead.siteCity || '',
            district: clean(clientData.district),
            country: clientData.country || "Côte d'Ivoire",
            notes: clean(clientData.notes),
            status: 'ACTIF',
            createdById: lead.createdById || undefined,
          },
        }),
        this.prisma.crmLead.update({
          where: { id: leadId },
          data: {
            stage: 'GAGNE',
            probability: 100,
            wonDate: new Date(),
          },
        }),
      ])

      // Link lead to client
      await this.prisma.crmLead.update({
        where: { id: leadId },
        data: { clientId: client.id },
      })

      // Notify DG of conversion
      if (lead.createdById) {
        const creator = await this.prisma.user.findUnique({ where: { id: lead.createdById }, select: { firstName: true, lastName: true } })
        if (creator) {
          this.notifications.notifyProspectConverted(lead, client.name, `${creator.firstName} ${creator.lastName}`).catch(() => {})
        }
      }

      return client
    } catch (err) {
      console.error('❌ convertToClient error:', err)
      throw err
    }
  }

  // ── Activities ──
  async addActivity(leadId: string, data: any) {
    const activity = await this.prisma.leadActivity.create({
      data: {
        leadId,
        type: data.type ?? 'NOTE',
        summary: data.summary,
        details: data.details,
        date: data.date ? new Date(data.date) : new Date(),
        performedBy: data.performedBy,
      },
    })
    // Update next action
    if (data.nextActionDate) {
      await this.prisma.crmLead.update({
        where: { id: leadId },
        data: { nextActionDate: new Date(data.nextActionDate), nextActionNote: data.nextActionNote },
      })
    }
    return activity
  }

  async getActivities(leadId: string) {
    return this.prisma.leadActivity.findMany({
      where: { leadId },
      orderBy: { date: 'desc' },
    })
  }

  // ── Commercial performance stats (DG alerts) ──
  async getCommercialStats(user?: { id: string; role: string }) {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    weekStart.setHours(0, 0, 0, 0)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const baseWhere: any = {}
    if (user && user.role === 'COMMERCIAL') baseWhere.createdById = user.id

    // Prospects created this week grouped by commercial
    const weeklyByCommercial = await this.prisma.crmLead.groupBy({
      by: ['createdById'],
      where: { ...baseWhere, createdAt: { gte: weekStart } },
      _count: true,
    })

    // Stale prospects (NOUVEAU for > 30 days, not advanced)
    const thirtyDaysAgo = new Date(now)
    thirtyDaysAgo.setDate(now.getDate() - 30)
    const staleProspects = await this.prisma.crmLead.findMany({
      where: { ...baseWhere, stage: 'NOUVEAU', createdAt: { lt: thirtyDaysAgo } },
      select: { id: true, reference: true, companyName: true, contactName: true, createdById: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    // Overdue invoices (due date passed)
    const overdueInvoices = await this.prisma.invoice.findMany({
      where: { ...baseWhere, status: { in: ['BROUILLON', 'ENVOYEE'] }, dueDate: { lt: now } },
      select: { id: true, reference: true, totalAmount: true, dueDate: true, clientId: true, leadId: true },
      orderBy: { dueDate: 'asc' },
    })

    // Best commercial this month
    const monthlyCreated = await this.prisma.crmLead.groupBy({
      by: ['createdById'],
      where: { ...baseWhere, createdAt: { gte: monthStart } },
      _count: true,
    })
    const monthlyWon = await this.prisma.crmLead.groupBy({
      by: ['createdById'],
      where: { ...baseWhere, wonDate: { gte: monthStart } },
      _count: true,
    })

    const scores: Record<string, { created: number; won: number; score: number }> = {}
    for (const r of monthlyCreated) {
      if (!r.createdById) continue
      scores[r.createdById] = { created: r._count, won: 0, score: r._count }
    }
    for (const r of monthlyWon) {
      if (!r.createdById) continue
      if (!scores[r.createdById]) scores[r.createdById] = { created: 0, won: 0, score: 0 }
      scores[r.createdById].won = r._count
      scores[r.createdById].score += r._count * 3
    }
    const ranking = Object.entries(scores)
      .map(([userId, s]) => ({ userId, ...s }))
      .sort((a, b) => b.score - a.score)

    // Resolve user names
    const allUserIds = new Set<string>()
    for (const r of weeklyByCommercial) { if (r.createdById) allUserIds.add(r.createdById) }
    for (const r of staleProspects) { if (r.createdById) allUserIds.add(r.createdById) }
    for (const r of ranking) { if (r.userId) allUserIds.add(r.userId) }

    const users = allUserIds.size > 0
      ? await this.prisma.user.findMany({ where: { id: { in: [...allUserIds] } }, select: { id: true, firstName: true, lastName: true } })
      : []
    const userMap: Record<string, string> = {}
    for (const u of users) { userMap[u.id] = `${u.firstName} ${u.lastName}` }

    // Enrich with names
    const rankingWithNames = ranking.map(r => ({ ...r, userName: userMap[r.userId] ?? r.userId }))
    const weeklyWithNames = weeklyByCommercial.map((r: any) => ({ ...r, userName: userMap[r.createdById] ?? r.createdById }))
    const staleWithNames = staleProspects.map((p: any) => ({ ...p, commercialName: userMap[p.createdById] ?? p.createdById }))

    // Alerts
    const alerts: { type: string; message: string; severity: string }[] = []

    // Alert: objective not reached (10 prospects/week)
    const WEEKLY_GOAL = 10
    const totalWeek = weeklyByCommercial.reduce((s, r) => s + r._count, 0)
    if (totalWeek < WEEKLY_GOAL) {
      alerts.push({ type: 'PROSPECTION_GOAL', message: `Objectif hebdo non atteint : ${totalWeek}/${WEEKLY_GOAL} prospects cette semaine`, severity: 'WARNING' })
    }

    // Alert: stale prospects
    if (staleProspects.length > 0) {
      alerts.push({ type: 'STALE_PROSPECTS', message: `${staleProspects.length} prospect(s) non avancé(s) depuis +30 jours`, severity: 'WARNING' })
    }

    // Alert: overdue invoices
    if (overdueInvoices.length > 0) {
      alerts.push({ type: 'OVERDUE_INVOICES', message: `${overdueInvoices.length} facture(s) en retard d'échéance`, severity: 'CRITICAL' })
    }

    // Alert: best commercial
    if (rankingWithNames.length > 0) {
      alerts.push({ type: 'BEST_COMMERCIAL', message: `Meilleur commercial du mois : ${rankingWithNames[0].userName} (${rankingWithNames[0].created} prospects, ${rankingWithNames[0].won} gagnés)`, severity: 'INFO' })
    }

    return { weeklyByCommercial: weeklyWithNames, staleProspects: staleWithNames, overdueInvoices, ranking: rankingWithNames, alerts }
  }

  // ── Stats ──
  async getPipelineStats(user?: { id: string; role: string }) {
    const stages = ['NOUVEAU', 'QUALIFIE', 'PROPOSITION', 'NEGOCIATION', 'GAGNE', 'PERDU']
    const baseWhere: any = {}
    if (user && user.role === 'COMMERCIAL') baseWhere.createdById = user.id
    const counts = await Promise.all(
      stages.map(async (stage) => ({
        stage,
        count: await this.prisma.crmLead.count({ where: { ...baseWhere, stage: stage as any } }),
        revenue: await this.prisma.crmLead.aggregate({
          where: { ...baseWhere, stage: stage as any },
          _sum: { estimatedRevenue: true },
        }),
      })),
    )
    return counts.map(c => ({
      stage: c.stage,
      count: c.count,
      totalRevenue: c.revenue._sum.estimatedRevenue ?? 0,
    }))
  }
}
