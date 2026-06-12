import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

type Frequency = 'MENSUELLE' | 'TRIMESTRIELLE' | 'SEMESTRIELLE' | 'ANNUELLE'

@Injectable()
export class BillingRunsService {
  constructor(private prisma: PrismaService) {}

  private async generateReference() {
    const year  = new Date().getFullYear()
    const count = await this.prisma.billingRun.count({
      where: { reference: { startsWith: `LOT-${year}-` } },
    })
    return `LOT-${year}-${String(count + 1).padStart(4, '0')}`
  }

  async findAll() {
    return this.prisma.billingRun.findMany({
      orderBy: { invoiceDate: 'desc' },
      include: { _count: { select: { invoices: true } } },
    })
  }

  async findOne(id: string) {
    const run = await this.prisma.billingRun.findUnique({
      where: { id },
      include: {
        invoices: { include: { client: { select: { name: true } }, contract: { select: { reference: true, title: true } } } },
      },
    })
    if (!run) throw new NotFoundException('Lot de facturation introuvable')
    return run
  }

  // ─── Étape 1 : créer le lot en brouillon ───
  async create(data: {
    period: string;          // ex. "2026-05"
    invoiceDate: Date;
    invoicingFrequency?: Frequency;
    notes?: string;
    createdById?: string;
  }) {
    if (!/^\d{4}-\d{2}$/.test(data.period)) {
      throw new BadRequestException('Format période invalide. Attendu: YYYY-MM (ex: 2026-05).')
    }
    const reference = await this.generateReference()
    return this.prisma.billingRun.create({
      data: {
        reference,
        period: data.period,
        invoiceDate: data.invoiceDate,
        invoicingFrequency: (data.invoicingFrequency ?? 'MENSUELLE') as any,
        notes: data.notes,
        state: 'BROUILLON',
        createdById: data.createdById,
      },
    })
  }

  // ─── Étape 2 : prévisualiser les contrats éligibles ───
  async previewContracts(id: string) {
    const run = await this.findOne(id)
    if (run.state !== 'BROUILLON') {
      throw new BadRequestException('Le lot a déjà été exécuté.')
    }
    const contracts = await this.prisma.clientContract.findMany({
      where: {
        status: 'ACTIF',
        invoicingFrequency: run.invoicingFrequency,
      },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { reference: 'asc' },
    })
    const total = contracts.reduce((s, c) => s + Number(c.monthlyAmount), 0)
    return { contracts, total, count: contracts.length }
  }

  // ─── Étape 3 : générer les factures ───
  async generateInvoices(id: string, userId = 'system') {
    const run = await this.findOne(id)
    if (run.state !== 'BROUILLON') {
      throw new BadRequestException('Lot déjà exécuté ou annulé.')
    }

    const contracts = await this.prisma.clientContract.findMany({
      where: { status: 'ACTIF', invoicingFrequency: run.invoicingFrequency },
    })
    if (contracts.length === 0) {
      throw new BadRequestException(`Aucun contrat actif avec la fréquence ${run.invoicingFrequency}.`)
    }

    const created: any[] = []
    let totalAmount = 0

    for (const c of contracts) {
      const count = await this.prisma.invoice.count()
      const reference = `FAC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`
      const dueDate = new Date(run.invoiceDate)
      dueDate.setDate(dueDate.getDate() + (c.paymentTermDays ?? 30))
      const subtotal    = Number(c.monthlyAmount)
      const taxAmount   = Math.round(subtotal * 0.18)
      const total       = subtotal + taxAmount

      const invoice = await this.prisma.invoice.create({
        data: {
          reference, type: 'FACTURE', status: 'BROUILLON',
          clientId: c.clientId, contractId: c.id, billingRunId: run.id,
          issueDate: run.invoiceDate, dueDate, currency: c.currency,
          subtotal, taxRate: 18, taxAmount, totalAmount: total,
          notes: `${c.title ?? c.reference} — Période ${run.period}`,
          lines: { create: [{
            code: 'SEC-SVC',
            description: `${c.title ?? 'Prestation sécurité'} — ${run.period}`,
            quantity: 1, unitPrice: subtotal, total: subtotal,
          }] },
        },
      })
      created.push(invoice)
      totalAmount += total
    }

    return this.prisma.billingRun.update({
      where: { id },
      data: { state: 'EXECUTE', totalAmount },
      include: { invoices: true },
    })
  }

  async cancel(id: string) {
    const run = await this.findOne(id)
    if (run.state === 'EXECUTE') {
      throw new BadRequestException('Impossible d\'annuler un lot déjà exécuté.')
    }
    return this.prisma.billingRun.update({ where: { id }, data: { state: 'ANNULE' } })
  }
}
