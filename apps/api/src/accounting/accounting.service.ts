import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class AccountingService {
  constructor(private prisma: PrismaService) {}

  // ── Dashboard financier ──────────────────────────────────
  async getDashboard(year?: number) {
    const y = year ?? new Date().getFullYear()
    const startOfYear = new Date(y, 0, 1)
    const endOfYear   = new Date(y + 1, 0, 1)

    // Revenus: factures payées
    const invoicesPaid = await this.prisma.invoice.findMany({
      where: { status: 'PAYEE', paidAt: { gte: startOfYear, lt: endOfYear } },
      select: { totalAmount: true, paidAt: true, paidAmount: true },
    })
    const totalRevenue = invoicesPaid.reduce((s, i) => s + Number(i.paidAmount ?? i.totalAmount), 0)

    // Revenus par mois
    const revenueByMonth = Array.from({ length: 12 }, (_, m) => ({
      month: m + 1,
      label: new Date(y, m).toLocaleString('fr-FR', { month: 'short' }),
      amount: 0,
    }))
    for (const inv of invoicesPaid) {
      const m = new Date(inv.paidAt!).getMonth()
      revenueByMonth[m].amount += Number(inv.paidAmount ?? inv.totalAmount)
    }

    // Factures en attente
    const invoicesPending = await this.prisma.invoice.aggregate({
      where: { status: { in: ['ENVOYEE', 'RETARD'] } },
      _sum: { totalAmount: true },
      _count: true,
    })
    const totalPending = Number(invoicesPending._sum.totalAmount ?? 0)
    const pendingCount = invoicesPending._count

    // Charges salariales
    const payrolls = await this.prisma.payroll.findMany({
      where: { year: y, status: { in: ['VALIDE', 'PAYE'] } },
      select: { month: true, totalBrut: true, totalNet: true },
    })
    const totalSalaries = payrolls.reduce((s, p) => s + Number(p.totalBrut), 0)
    const salaryByMonth = Array.from({ length: 12 }, (_, m) => ({ month: m + 1, amount: 0 }))
    for (const p of payrolls) {
      salaryByMonth[p.month - 1].amount += Number(p.totalBrut)
    }

    // Charges véhicules (carburant + maintenance)
    const fuelCosts = await this.prisma.fuelLog.aggregate({
      where: { date: { gte: startOfYear, lt: endOfYear } },
      _sum: { totalCost: true },
    })
    const maintenanceCosts = await this.prisma.maintenance.aggregate({
      where: { startDate: { gte: startOfYear, lt: endOfYear } },
      _sum: { cost: true },
    })
    const totalFuel = Number(fuelCosts._sum.totalCost ?? 0)
    const totalMaintenance = Number(maintenanceCosts._sum.cost ?? 0)

    const totalExpenses = totalSalaries + totalFuel + totalMaintenance
    const netResult = totalRevenue - totalExpenses

    return {
      year: y,
      revenue: { total: totalRevenue, byMonth: revenueByMonth },
      pending: { total: totalPending, count: pendingCount },
      expenses: {
        total: totalExpenses,
        salaries: totalSalaries,
        salaryByMonth,
        fuel: totalFuel,
        maintenance: totalMaintenance,
      },
      netResult,
      margin: totalRevenue > 0 ? Math.round((netResult / totalRevenue) * 100) : 0,
    }
  }

  // ── Journal comptable (écritures virtuelles) ─────────────
  async getJournal(filters?: { year?: number; month?: number; type?: string }) {
    const y = filters?.year ?? new Date().getFullYear()
    const m = filters?.month
    const startDate = m ? new Date(y, m - 1, 1) : new Date(y, 0, 1)
    const endDate   = m ? new Date(y, m, 1) : new Date(y + 1, 0, 1)

    const entries: any[] = []

    // Factures émises → Produits (ventes)
    if (!filters?.type || filters.type === 'VENTE') {
      const invoices = await this.prisma.invoice.findMany({
        where: {
          issueDate: { gte: startDate, lt: endDate },
          type: 'FACTURE',
        },
        include: { client: { select: { name: true } } },
        orderBy: { issueDate: 'asc' },
      })
      for (const inv of invoices) {
        entries.push({
          id: `INV-${inv.id}`,
          date: inv.issueDate,
          type: 'VENTE',
          reference: inv.reference,
          description: `Facture ${inv.reference} — ${inv.client?.name ?? 'N/A'}`,
          debit: inv.status === 'PAYEE' ? 0 : Number(inv.totalAmount),
          credit: inv.status === 'PAYEE' ? Number(inv.totalAmount) : 0,
          account: inv.status === 'PAYEE' ? '7011 — Ventes prestations sécurité' : '4111 — Clients',
          status: inv.status,
        })
      }
    }

    // Paiements reçus
    if (!filters?.type || filters.type === 'ENCAISSEMENT') {
      const paid = await this.prisma.invoice.findMany({
        where: {
          paidAt: { gte: startDate, lt: endDate },
          status: 'PAYEE',
        },
        include: { client: { select: { name: true } } },
        orderBy: { paidAt: 'asc' },
      })
      for (const inv of paid) {
        entries.push({
          id: `PAY-${inv.id}`,
          date: inv.paidAt,
          type: 'ENCAISSEMENT',
          reference: inv.reference,
          description: `Encaissement ${inv.reference} — ${inv.client?.name ?? 'N/A'}`,
          debit: 0,
          credit: Number(inv.paidAmount ?? inv.totalAmount),
          account: '5211 — Banque',
          status: 'PAYEE',
        })
      }
    }

    // Salaires
    if (!filters?.type || filters.type === 'SALAIRE') {
      const payrolls = await this.prisma.payroll.findMany({
        where: {
          year: y,
          ...(m && { month: m }),
          status: { in: ['VALIDE', 'PAYE'] },
        },
        orderBy: { month: 'asc' },
      })
      for (const p of payrolls) {
        entries.push({
          id: `SAL-${p.id}`,
          date: p.processedAt ?? new Date(p.year, p.month - 1, 28),
          type: 'SALAIRE',
          reference: `PAIE-${String(p.month).padStart(2, '0')}/${p.year}`,
          description: `Masse salariale ${String(p.month).padStart(2, '0')}/${p.year}`,
          debit: Number(p.totalBrut),
          credit: 0,
          account: '6611 — Rémunérations du personnel',
          status: p.status,
        })
      }
    }

    // Carburant
    if (!filters?.type || filters.type === 'CARBURANT') {
      const fuels = await this.prisma.fuelLog.findMany({
        where: { date: { gte: startDate, lt: endDate } },
        include: { vehicle: { select: { plateNumber: true } } },
        orderBy: { date: 'asc' },
      })
      for (const f of fuels) {
        entries.push({
          id: `FUEL-${f.id}`,
          date: f.date,
          type: 'CARBURANT',
          reference: f.vehicle.plateNumber,
          description: `Carburant ${f.vehicle.plateNumber} (${f.liters}L)`,
          debit: Number(f.totalCost),
          credit: 0,
          account: '6055 — Fournitures carburant',
          status: 'PAYE',
        })
      }
    }

    // Maintenance
    if (!filters?.type || filters.type === 'MAINTENANCE') {
      const maints = await this.prisma.maintenance.findMany({
        where: { startDate: { gte: startDate, lt: endDate } },
        include: { vehicle: { select: { plateNumber: true } } },
        orderBy: { startDate: 'asc' },
      })
      for (const m of maints) {
        if (!m.cost) continue
        entries.push({
          id: `MAINT-${m.id}`,
          date: m.startDate,
          type: 'MAINTENANCE',
          reference: m.vehicle.plateNumber,
          description: `Maintenance ${m.type} — ${m.vehicle.plateNumber}`,
          debit: Number(m.cost),
          credit: 0,
          account: '6155 — Entretien véhicules',
          status: 'ENREGISTRE',
        })
      }
    }

    // Trier par date
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    // Solde cumulé
    let balance = 0
    for (const e of entries) {
      balance += e.credit - e.debit
      e.balance = balance
    }

    return { year: y, month: m, entries, totals: { debit: entries.reduce((s, e) => s + e.debit, 0), credit: entries.reduce((s, e) => s + e.credit, 0), balance } }
  }

  // ── Enregistrer un paiement sur une facture ─────────────
  async registerPayment(invoiceId: string, data: { amount?: number; paymentDate?: string; paymentMethod?: string; reference?: string }, userId?: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } })
    if (!invoice) throw new Error('Facture introuvable')

    const paidAmount = data.amount ?? Number(invoice.totalAmount)
    const paidAt = data.paymentDate ? new Date(data.paymentDate) : new Date()

    // Create a Payment record
    const payment = await this.prisma.payment.create({
      data: {
        invoiceId,
        amount: paidAmount,
        method: data.paymentMethod ?? 'VIREMENT',
        reference: data.reference ?? null,
        paidAt,
        recordedBy: userId ?? null,
      },
    })

    // Update invoice status
    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAYEE',
        paidAt,
        paidAmount,
      },
    })

    // Record in invoice history
    await this.prisma.invoiceHistory.create({
      data: {
        invoiceId,
        action: 'PAIEMENT',
        details: `Paiement de ${paidAmount} XOF enregistré (${data.paymentMethod ?? 'VIREMENT'})`,
        performedBy: userId ?? 'system',
      },
    })

    return { payment, invoice: updated }
  }

  // ── Factures impayées ──────────────────────────────────────
  async getUnpaidInvoices() {
    return this.prisma.invoice.findMany({
      where: { status: { in: ['ENVOYEE', 'RETARD'] }, type: 'FACTURE' },
      include: { client: { select: { name: true, code: true } } },
      orderBy: { dueDate: 'asc' },
    })
  }

  // ── Saisie de dépense manuelle ─────────────────────────────
  async recordExpense(data: { description: string; amount: number; account: string; date?: string; reference?: string; category?: string }, userId?: string) {
    const entry = await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE',
        entity: 'ManualExpense',
        entityId: null,
        newData: {
          description: data.description,
          amount: data.amount,
          account: data.account,
          date: data.date ? new Date(data.date) : new Date(),
          reference: data.reference ?? null,
          category: data.category ?? 'AUTRE',
        },
      },
    })
    return entry
  }

  // ── Récupérer les dépenses manuelles ──────────────────────
  async getExpenses(year?: number, month?: number) {
    const y = year ?? new Date().getFullYear()
    const startDate = month ? new Date(y, month - 1, 1) : new Date(y, 0, 1)
    const endDate   = month ? new Date(y, month, 1) : new Date(y + 1, 0, 1)

    const entries = await this.prisma.auditLog.findMany({
      where: {
        entity: 'ManualExpense',
        createdAt: { gte: startDate, lt: endDate },
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return entries.map(e => ({
      id: e.id,
      ...((e.newData as any) ?? {}),
      createdAt: e.createdAt,
      createdBy: e.user,
    }))
  }

  // ── Trésorerie (entrées / sorties par mois) ──────────────
  async getTreasury(year?: number) {
    const y = year ?? new Date().getFullYear()
    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      label: new Date(y, i).toLocaleString('fr-FR', { month: 'long' }),
      encaissements: 0,
      decaissements: 0,
      solde: 0,
    }))

    // Encaissements
    const paid = await this.prisma.invoice.findMany({
      where: { paidAt: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) }, status: 'PAYEE' },
      select: { paidAt: true, paidAmount: true, totalAmount: true },
    })
    for (const inv of paid) {
      const m = new Date(inv.paidAt!).getMonth()
      months[m].encaissements += Number(inv.paidAmount ?? inv.totalAmount)
    }

    // Décaissements salaires
    const payrolls = await this.prisma.payroll.findMany({
      where: { year: y, status: 'PAYE' },
      select: { month: true, totalNet: true },
    })
    for (const p of payrolls) {
      months[p.month - 1].decaissements += Number(p.totalNet)
    }

    // Décaissements carburant
    const fuels = await this.prisma.fuelLog.findMany({
      where: { date: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } },
      select: { date: true, totalCost: true },
    })
    for (const f of fuels) {
      months[new Date(f.date).getMonth()].decaissements += Number(f.totalCost)
    }

    // Décaissements maintenance
    const maints = await this.prisma.maintenance.findMany({
      where: { startDate: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) }, cost: { not: null } },
      select: { startDate: true, cost: true },
    })
    for (const m of maints) {
      months[new Date(m.startDate).getMonth()].decaissements += Number(m.cost ?? 0)
    }

    // Solde cumulé
    let cumul = 0
    for (const m of months) {
      m.solde = m.encaissements - m.decaissements
      cumul += m.solde
    }

    return { year: y, months, cumulativeSolde: cumul }
  }
}
