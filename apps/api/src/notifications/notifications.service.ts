import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationType } from '@prisma/client'

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    userId?: string
    type: NotificationType
    title: string
    message: string
    data?: any
  }) {
    return this.prisma.notification.create({ data })
  }

  async getUserNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { read: true, readAt: new Date() },
    })
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    })
  }

  async getUnreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, read: false } })
  }

  async notifyLateCheckin(pointage: any) {
    const agentName = `${pointage.agent.user.firstName} ${pointage.agent.user.lastName}`
    return this.create({
      type: 'POINTAGE' as NotificationType,
      title: 'Retard détecté',
      message: `L'agent ${agentName} a pointé en retard`,
      data: { pointageId: pointage.id, agentId: pointage.agentId },
    })
  }

  async notifyNewProspect(lead: any, commercialName: string) {
    const dgs = await this.prisma.user.findMany({ where: { role: 'DIRECTEUR_GENERAL', status: 'ACTIF' }, select: { id: true } })
    for (const dg of dgs) {
      await this.create({
        userId: dg.id,
        type: 'COMMERCIAL' as NotificationType,
        title: 'Nouveau prospect',
        message: `${commercialName} a enregistré un nouveau prospect : ${lead.title} (${lead.companyName ?? ''})`,
        data: { leadId: lead.id, reference: lead.reference },
      })
    }
  }

  async notifyProspectConverted(lead: any, clientName: string, commercialName: string) {
    const dgs = await this.prisma.user.findMany({ where: { role: 'DIRECTEUR_GENERAL', status: 'ACTIF' }, select: { id: true } })
    for (const dg of dgs) {
      await this.create({
        userId: dg.id,
        type: 'COMMERCIAL' as NotificationType,
        title: 'Prospect converti en client',
        message: `${commercialName} a converti le prospect "${lead.title}" en client "${clientName}"`,
        data: { leadId: lead.id },
      })
    }
  }

  async notifyNewIncident(incident: any, siteName: string, creatorName: string) {
    const recipients = await this.prisma.user.findMany({
      where: { role: { in: ['CHEF_OPERATIONS', 'DIRECTEUR_GENERAL'] as any }, status: 'ACTIF' },
      select: { id: true },
    })
    for (const u of recipients) {
      await this.create({
        userId: u.id,
        type: 'INCIDENT' as NotificationType,
        title: `Nouvel incident — ${incident.reference}`,
        message: `${creatorName} a signalé un incident "${incident.title}" sur le site ${siteName} (gravité: ${incident.severity ?? 'FAIBLE'}).`,
        data: { incidentId: incident.id, reference: incident.reference },
      })
    }
  }

  async notifyNewDailyReport(report: any, siteName: string, creatorName: string) {
    const recipients = await this.prisma.user.findMany({
      where: { role: { in: ['CHEF_OPERATIONS', 'DIRECTEUR_GENERAL'] as any }, status: 'ACTIF' },
      select: { id: true },
    })
    for (const u of recipients) {
      await this.create({
        userId: u.id,
        type: 'RAPPORT' as NotificationType,
        title: `Nouveau rapport quotidien — ${report.reference}`,
        message: `${creatorName} a créé un rapport quotidien pour le site ${siteName} (vacation: ${report.shift ?? 'JOUR'}).`,
        data: { reportId: report.id, reference: report.reference },
      })
    }
  }

  async notifyNewControlVisit(control: any, siteName: string, creatorName: string) {
    const recipients = await this.prisma.user.findMany({
      where: { role: { in: ['CHEF_OPERATIONS', 'DIRECTEUR_GENERAL'] as any }, status: 'ACTIF' },
      select: { id: true },
    })
    for (const u of recipients) {
      await this.create({
        userId: u.id,
        type: 'CONTROLE' as NotificationType,
        title: `Nouvelle visite de contrôle — ${control.reference}`,
        message: `${creatorName} a créé une visite de contrôle (${control.visitType ?? 'ROUTINE'}) sur le site ${siteName}.`,
        data: { controlId: control.id, reference: control.reference },
      })
    }
  }

  async notifyStagnantProspects() {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const stagnant = await this.prisma.crmLead.findMany({
      where: {
        stage: { in: ['NOUVEAU', 'QUALIFIE', 'PROPOSITION', 'NEGOCIATION'] },
        updatedAt: { lte: sevenDaysAgo },
      },
      select: { id: true, title: true, reference: true, companyName: true, createdById: true },
    })
    if (stagnant.length === 0) return

    const dgs = await this.prisma.user.findMany({ where: { role: 'DIRECTEUR_GENERAL', status: 'ACTIF' }, select: { id: true } })
    for (const dg of dgs) {
      await this.create({
        userId: dg.id,
        type: 'COMMERCIAL' as NotificationType,
        title: `${stagnant.length} prospect(s) stagnant(s)`,
        message: `Les prospects suivants n'ont pas avancé depuis 7 jours : ${stagnant.slice(0, 5).map(s => s.title).join(', ')}`,
        data: { leadIds: stagnant.map(s => s.id) },
      })
    }
  }
}
