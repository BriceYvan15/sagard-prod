import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ClientService {
  constructor(private prisma: PrismaService) {}

  /** Trouve le Client lié à un User (role CLIENT) */
  async findByUserId(userId: string) {
    const client = await this.prisma.client.findFirst({
      where: { userId },
      select: { id: true, name: true, code: true, email: true, phone: true, address: true, city: true, status: true },
    })
    if (!client) throw new NotFoundException('Aucun client lié à cet utilisateur')
    return client
  }

  /** Sites du client avec agents assignés et statut en poste */
  async getMySites(userId: string) {
    const client = await this.findByUserId(userId)

    const sites = await this.prisma.site.findMany({
      where: { clientId: client.id, status: 'ACTIF' },
      select: {
        id: true, name: true, code: true, address: true, city: true, district: true,
        latitude: true, longitude: true, nbAgentsRequired: true, riskLevel: true,
        hasArmed: true, hasCanine: true,
      },
      orderBy: { name: 'asc' },
    })

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const result = await Promise.all(sites.map(async (site) => {
      // Agents assignés (déploiements actifs)
      const deployments = await this.prisma.agentDeployment.findMany({
        where: { siteId: site.id, state: 'ACTIF', isActive: true },
        include: {
          agent: {
            select: {
              id: true, matricule: true, shift: true, status: true,
              user: { select: { id: true, firstName: true, lastName: true, phone: true, photoUrl: true } },
            },
          },
        },
      })

      // Pointages du jour pour ce site
      const todayPointages = await this.prisma.pointage.findMany({
        where: { siteId: site.id, date: today, status: { in: ['EN_COURS', 'PRESENT', 'RETARD'] } },
        select: { agentId: true, status: true, checkInTime: true, shift: true },
      })

      const agentsOnPost = todayPointages.length
      const agentsAssigned = deployments.length

      return {
        ...site,
        agentsAssigned,
        agentsOnPost,
        agents: deployments.map((d) => {
          const pointage = todayPointages.find((p) => p.agentId === d.agentId)
          return {
            id: d.agent.id,
            matricule: d.agent.matricule,
            firstName: d.agent.user.firstName,
            lastName: d.agent.user.lastName,
            phone: d.agent.user.phone,
            photoUrl: d.agent.user.photoUrl,
            shift: d.shift,
            agentStatus: d.agent.status,
            onPost: !!pointage,
            pointageStatus: pointage?.status ?? null,
            checkInTime: pointage?.checkInTime ?? null,
          }
        }),
      }
    }))

    return result
  }

  /** Factures du client */
  async getMyInvoices(userId: string) {
    const client = await this.findByUserId(userId)

    const invoices = await this.prisma.invoice.findMany({
      where: { clientId: client.id, type: 'FACTURE' },
      select: {
        id: true, reference: true, status: true, totalAmount: true,
        issueDate: true, dueDate: true, paidAt: true, currency: true,
        lines: { select: { id: true, description: true, quantity: true, unitPrice: true, total: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return invoices.map((inv) => ({
      ...inv,
      totalAmount: Number(inv.totalAmount),
      lines: inv.lines.map((l) => ({
        ...l,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        total: Number(l.total),
      })),
    }))
  }

  /** Détail d'une facture du client */
  async getInvoiceDetail(userId: string, invoiceId: string) {
    const client = await this.findByUserId(userId)
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, clientId: client.id },
      include: { lines: true, client: { select: { name: true, address: true, city: true, phone: true, email: true } } },
    })
    if (!invoice) throw new NotFoundException('Facture introuvable')
    return {
      ...invoice,
      totalAmount: Number(invoice.totalAmount),
      subtotal: Number(invoice.subtotal),
      taxAmount: Number(invoice.taxAmount),
      lines: invoice.lines.map((l) => ({
        ...l,
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
        total: Number(l.total),
      })),
    }
  }
}
