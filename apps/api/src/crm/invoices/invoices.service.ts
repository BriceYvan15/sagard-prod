import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: { clientId?: string; status?: string; type?: string; month?: string }, user?: { id: string; role: string }) {
    const where: any = {}
    if (filters?.clientId) where.clientId = filters.clientId
    if (filters?.status)   where.status   = filters.status
    if (filters?.type)     where.type     = filters.type
    if (filters?.month) {
      const d = new Date(filters.month)
      where.createdAt = { gte: new Date(d.getFullYear(), d.getMonth(), 1), lt: new Date(d.getFullYear(), d.getMonth() + 1, 1) }
    }
    // Les commerciaux ne voient que les documents qu'ils ont créés
    if (user && user.role === 'COMMERCIAL') {
      where.createdById = user.id
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

  async createCatalogItem(data: { code: string; description: string; unitPrice?: number }) {
    return this.prisma.serviceCatalog.create({
      data: {
        code: data.code,
        description: data.description,
        unitPrice: data.unitPrice ?? null,
        isActive: true,
      },
    })
  }

  async updateCatalogItem(id: string, data: { description?: string; unitPrice?: number; isActive?: boolean }) {
    return this.prisma.serviceCatalog.update({
      where: { id },
      data: {
        ...(data.description !== undefined && { description: data.description }),
        ...(data.unitPrice !== undefined && { unitPrice: data.unitPrice }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    })
  }

  async deleteCatalogItem(id: string) {
    return this.prisma.serviceCatalog.delete({ where: { id } })
  }

  async resetCatalog() {
    const items = [
      { description: 'Agent de sécurité – Vacation de jour', unitPrice: 150000 },
      { description: 'Agent de sécurité – Vacation de nuit', unitPrice: 170000 },
      { description: 'Agent de sécurité armé – Vacation de jour', unitPrice: 180000 },
      { description: 'Agent de sécurité armé – Vacation de nuit', unitPrice: 200000 },
      { description: 'Agent cynophile – Vacation de jour', unitPrice: 170000 },
      { description: 'Agent cynophile – Vacation de nuit', unitPrice: 210000 },
      { description: 'Agent de sécurité – Extra/jour', unitPrice: 10000 },
      { description: 'Agent de sécurité armé – Extra/jour', unitPrice: 25000 },
      { description: 'Intervention mobile – (02) Agents', unitPrice: 30000 },
      { description: 'SecureCare360° | Maintenance des équipements électroniques', unitPrice: 30000 },
      { description: 'Protection rapprochée VIP/jour', unitPrice: 25000 },
      { description: 'Escorte de marchandise/km', unitPrice: null },
      { description: 'Frais de mise en service', unitPrice: null },
      { description: 'Surveillance événementielle', unitPrice: null },
      { description: 'Caméra 2MP – Intérieur/Extérieur', unitPrice: 15000 },
      { description: 'Caméra 5MP – Intérieur/Extérieur', unitPrice: 25000 },
      { description: 'Caméra IP', unitPrice: 30000 },
      { description: 'Caméra IP Plus', unitPrice: 40000 },
      { description: 'Caméra IP Solaire 4G', unitPrice: 40000 },
      { description: 'Caméra IP Solaire 5G', unitPrice: 45000 },
      { description: 'Caméra IP Solaire 5G Plus', unitPrice: 75000 },
      { description: 'Caméra Dôme Colorvu Hikvision AHD 2MP Audio/Vidéo', unitPrice: 25000 },
      { description: 'Caméra Dôme Colorvu Hikvision AHD 6MP Audio/Vidéo', unitPrice: 45000 },
      { description: 'Disque Dur 1 To', unitPrice: 25000 },
      { description: 'Disque Dur 2 To', unitPrice: 35000 },
      { description: 'DVR 4 Ports', unitPrice: 30000 },
      { description: 'DVR 8 Ports', unitPrice: 35000 },
      { description: 'DVR 16 Ports', unitPrice: 60000 },
      { description: 'Vidéosurveillance – Alimentation', unitPrice: null },
      { description: 'Coffret d\'alimentation 4 Ch', unitPrice: 12000 },
      { description: 'Coffret d\'alimentation 8 Ch', unitPrice: 17000 },
      { description: 'Coffret d\'alimentation 16 Ch', unitPrice: 22000 },
      { description: 'Câble coaxial 1 mètre', unitPrice: 300 },
      { description: 'Câble coaxial 100 mètres', unitPrice: 20000 },
      { description: 'Câble coaxial 302 mètres', unitPrice: 70000 },
      { description: 'Câble RJ45 1 mètre', unitPrice: 350 },
      { description: 'Câble RJ45 100 mètres', unitPrice: 30000 },
      { description: 'Câble RJ45 305 mètres', unitPrice: 80000 },
      { description: 'Interphone – Audio/Vidéo', unitPrice: 90000 },
      { description: 'Pointeur de présence', unitPrice: 112000 },
      { description: 'Répétiteur Wifi', unitPrice: 15000 },
      { description: 'Armoire informatique', unitPrice: 46000 },
      { description: 'Système anti-intrusion', unitPrice: 120000 },
      { description: 'Installation vidéosurveillance', unitPrice: null },
    ]

    await this.prisma.serviceCatalog.deleteMany({})
    let order = 0
    for (const item of items) {
      const code = item.description.slice(0, 10).toUpperCase().replace(/\s/g, '_').replace(/[^A-Z0-9_]/g, '').slice(0, 10)
      await this.prisma.serviceCatalog.create({
        data: {
          code: `${code}_${order}`,
          description: item.description,
          unitPrice: item.unitPrice,
          isActive: true,
          sortOrder: order++,
        },
      })
    }
    return { count: items.length }
  }

  async create(data: {
    clientId?: string; leadId?: string; contractId?: string;
    type: 'FACTURE' | 'DEVIS' | 'PROFORMA';
    lines: { description: string; quantity: number; unitPrice: number }[];
    dueDate: Date; issueDate?: Date; notes?: string; paymentMethod?: string;
  }, user?: { id: string; role: string }) {
    if (!data.clientId && !data.leadId) {
      throw new BadRequestException('Client ou prospect obligatoire')
    }

    const prefix = data.type === 'FACTURE' ? 'FAC' : data.type === 'DEVIS' ? 'DEV' : 'PRO'
    const year = new Date().getFullYear()
    const prefixFull = `${prefix}-${year}-`
    const lastInvoice = await this.prisma.invoice.findFirst({
      where: { reference: { startsWith: prefixFull } },
      orderBy: { reference: 'desc' },
      select: { reference: true },
    })
    let nextNum = 1
    if (lastInvoice) {
      const parts = lastInvoice.reference.split('-')
      nextNum = (parseInt(parts[parts.length - 1], 10) || 0) + 1
    }
    const reference = `${prefixFull}${String(nextNum).padStart(4, '0')}`

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
        dueDate:        data.dueDate,
        issueDate:      data.issueDate ?? new Date(),
        notes:          data.notes,
        paymentMethod:  data.paymentMethod as any ?? undefined,
        createdById:    user?.id ?? undefined,
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
      ENVOYEE:   ['ACCEPTEE', 'ANNULEE', 'RETARD', 'PARTIELLEMENT_PAYEE'],
      ACCEPTEE:  ['PAYEE', 'PARTIELLEMENT_PAYEE', 'ANNULEE'],
      PARTIELLEMENT_PAYEE: ['PAYEE', 'ANNULEE'],
      RETARD:    ['PAYEE', 'PARTIELLEMENT_PAYEE', 'ANNULEE'],
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
      data: {
        status: 'PAYEE',
        paidAt: new Date(),
        paidAmount: inv.totalAmount,
        paymentMethod: paymentMethod as any ?? undefined,
      },
    })
  }

  async markOverdue() {
    const now = new Date()
    return this.prisma.invoice.updateMany({
      where: { type: 'FACTURE', status: { in: ['BROUILLON', 'ENVOYEE'] }, dueDate: { lt: now } },
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

  async remove(id: string) {
    const inv = await this.findOne(id)
    await this.prisma.invoiceLine.deleteMany({ where: { invoiceId: id } })
    await this.prisma.invoiceHistory.deleteMany({ where: { invoiceId: id } })
    return this.prisma.invoice.delete({ where: { id } })
  }

  async update(id: string, data: {
    issueDate?: Date; dueDate?: Date; notes?: string; paymentMethod?: string;
    lines?: { description: string; quantity: number; unitPrice: number }[];
  }) {
    const inv = await this.findOne(id)
    if (inv.status === 'PAYEE') {
      throw new BadRequestException('Impossible de modifier une facture payée')
    }

    const updateData: any = {}
    if (data.issueDate !== undefined) updateData.issueDate = data.issueDate
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate
    if (data.notes !== undefined) updateData.notes = data.notes
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod as any

    if (data.lines && data.lines.length > 0) {
      const subtotal = data.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
      updateData.subtotal = subtotal
      updateData.taxAmount = 0
      updateData.totalAmount = subtotal

      await this.prisma.invoiceLine.deleteMany({ where: { invoiceId: id } })
      updateData.lines = {
        create: data.lines.map(l => ({
          code: l.description.slice(0, 10).toUpperCase().replace(/\s/g, '_'),
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          total: l.quantity * l.unitPrice,
        })),
      }
    }

    return this.prisma.invoice.update({
      where: { id },
      data: updateData,
      include: { client: { select: { name: true } }, lines: true },
    })
  }

  async getStats() {
    const [total, paid, overdue, pending] = await Promise.all([
      this.prisma.invoice.aggregate({ _sum: { totalAmount: true }, where: { type: 'FACTURE' } }),
      this.prisma.invoice.aggregate({ _sum: { totalAmount: true }, where: { type: 'FACTURE', status: 'PAYEE' } }),
      this.prisma.invoice.findMany({ where: { type: 'FACTURE', status: 'RETARD' }, include: { client: { select: { name: true } } }, orderBy: { dueDate: 'asc' }, take: 10 }),
      this.prisma.invoice.count({ where: { type: 'FACTURE', status: { in: ['BROUILLON', 'ENVOYEE'] } } }),
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
