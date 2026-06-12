import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: { clientId?: string; status?: string; type?: string; month?: string }) {
    const where: any = {}
    if (filters?.clientId) where.clientId = filters.clientId
    if (filters?.status)   where.status   = filters.status
    if (filters?.type)     where.type     = filters.type
    if (filters?.month) {
      const d = new Date(filters.month)
      where.createdAt = { gte: new Date(d.getFullYear(), d.getMonth(), 1), lt: new Date(d.getFullYear(), d.getMonth() + 1, 1) }
    }
    return this.prisma.invoice.findMany({
      where,
      include: {
        client:   { select: { id: true, name: true } },
        lead:     { select: { id: true, companyName: true, contactName: true, reference: true } },
        contract: { select: { id: true, reference: true, type: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string) {
    const inv = await this.prisma.invoice.findUnique({
      where: { id },
      include: { client: true, lead: true, contract: true, lines: true },
    })
    if (!inv) throw new NotFoundException('Facture introuvable')
    return inv
  }

  async getServiceCatalog() {
    return this.prisma.serviceCatalog.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    })
  }

  async create(data: {
    clientId?: string; leadId?: string; contractId?: string;
    type: 'FACTURE' | 'DEVIS' | 'PROFORMA';
    lines: { description: string; quantity: number; unitPrice: number }[];
    dueDate: Date; notes?: string;
  }) {
    if (!data.clientId && !data.leadId) {
      throw new BadRequestException('Client ou prospect obligatoire')
    }

    const count = await this.prisma.invoice.count()
    const prefix = data.type === 'FACTURE' ? 'FAC' : data.type === 'DEVIS' ? 'DEV' : 'PRO'
    const reference = `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`

    const subtotal = data.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
    const totalAmount = subtotal

    return this.prisma.invoice.create({
      data: {
        reference,
        clientId:   data.clientId || undefined,
        leadId:     data.leadId || undefined,
        contractId: data.contractId,
        type:       data.type as any,
        status:     'BROUILLON',
        subtotal,
        taxRate:    0,
        taxAmount:  0,
        totalAmount,
        dueDate:    data.dueDate,
        notes:      data.notes,
        lines: {
          create: data.lines.map(l => ({
            code:        l.description.slice(0, 10).toUpperCase().replace(/\s/g, '_'),
            description: l.description,
            quantity:    l.quantity,
            unitPrice:   l.unitPrice,
            total:       l.quantity * l.unitPrice,
          })),
        },
      },
      include: { client: { select: { name: true } }, lead: { select: { companyName: true, contactName: true } }, lines: true },
    })
  }

  async updateStatus(id: string, status: string) {
    const inv = await this.findOne(id)
    const ALLOWED: Record<string, string[]> = {
      BROUILLON: ['ENVOYEE', 'ANNULEE'],
      ENVOYEE:   ['ACCEPTEE', 'ANNULEE', 'RETARD'],
      ACCEPTEE:  ['PAYEE'],
      RETARD:    ['PAYEE', 'ANNULEE'],
      PAYEE:     [],
      ANNULEE:   [],
    }
    const allowed = ALLOWED[inv.status] ?? []
    if (!allowed.includes(status)) {
      throw new BadRequestException(`Transition interdite : ${inv.status} → ${status}`)
    }
    return this.prisma.invoice.update({
      where: { id },
      data: { status: status as any, ...(status === 'PAYEE' ? { paidAt: new Date() } : {}) },
    })
  }

  async markPaid(id: string, paymentMethod: string) {
    const inv = await this.findOne(id)
    if (inv.status === 'PAYEE') throw new BadRequestException('Facture déjà payée')
    return this.prisma.invoice.update({
      where: { id },
      data: { status: 'PAYEE', paidAt: new Date() },
    })
  }

  async markOverdue() {
    const now = new Date()
    return this.prisma.invoice.updateMany({
      where: { status: { in: ['BROUILLON', 'ENVOYEE'] }, dueDate: { lt: now } },
      data: { status: 'RETARD' },
    })
  }

  async convertToInvoice(id: string) {
    const devis = await this.findOne(id)
    if (!['DEVIS', 'PROFORMA'].includes(devis.type)) throw new BadRequestException('Seuls les devis/proforma peuvent être convertis')

    const count = await this.prisma.invoice.count()
    const reference = `FAC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    return this.prisma.invoice.create({
      data: {
        reference, clientId: devis.clientId, contractId: devis.contractId,
        type:       'FACTURE',
        status:     'BROUILLON',
        subtotal: devis.subtotal,
        taxRate:  0,
        taxAmount: 0,
        totalAmount: devis.subtotal,
        dueDate,
        notes: `Converti depuis ${devis.reference}`,
      },
    })
  }

  async getStats() {
    const [total, paid, overdue, pending] = await Promise.all([
      this.prisma.invoice.aggregate({ _sum: { totalAmount: true }, where: { type: 'FACTURE' } }),
      this.prisma.invoice.aggregate({ _sum: { totalAmount: true }, where: { type: 'FACTURE', status: 'PAYEE' } }),
      this.prisma.invoice.findMany({ where: { status: 'RETARD' }, include: { client: { select: { name: true } } }, orderBy: { dueDate: 'asc' }, take: 10 }),
      this.prisma.invoice.count({ where: { status: { in: ['BROUILLON', 'ENVOYEE'] } } }),
    ])
    return {
      totalFacturé: Number(total._sum.totalAmount ?? 0),
      totalPayé:    Number(paid._sum.totalAmount ?? 0),
      nbEnRetard:   overdue.length,
      nbEnAttente:  pending,
      facturesEnRetard: overdue,
    }
  }

  async generateMonthlyInvoices() {
    const contracts = await this.prisma.clientContract.findMany({
      where: { status: 'ACTIF' },
      include: { client: { select: { id: true, name: true } } },
    })

    const created = []
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 30)

    for (const contract of contracts) {
      const inv = await this.create({
        clientId:   contract.clientId,
        contractId: contract.id,
        type:       'FACTURE',
        lines:      [{ description: contract.title || `Prestation gardiennage — ${contract.contractType ?? contract.type ?? ''}`, quantity: 1, unitPrice: Number(contract.monthlyAmount) }],
        dueDate,
      })
      created.push(inv)
    }
    return { generated: created.length, invoices: created }
  }
}
