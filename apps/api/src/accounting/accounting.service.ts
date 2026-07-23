import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TreasuryService } from '../treasury/treasury.service'

@Injectable()
export class AccountingService {
  constructor(private prisma: PrismaService, private treasury: TreasuryService) {}

  // ── Dashboard financier ──────────────────────────────────
  async getDashboard(year?: number) {
    const y = year ?? new Date().getFullYear()
    const startOfYear = new Date(y, 0, 1)
    const endOfYear   = new Date(y + 1, 0, 1)

    // Revenus: factures payées
    const invoicesPaid = await this.prisma.invoice.findMany({
      where: { type: 'FACTURE', status: 'PAYEE', issueDate: { gte: startOfYear, lt: endOfYear } },
      select: { totalAmount: true, issueDate: true, paidAmount: true },
    })
    const totalRevenue = invoicesPaid.reduce((s, i) => s + Number(i.paidAmount ?? i.totalAmount), 0)

    // Revenus par mois
    const revenueByMonth = Array.from({ length: 12 }, (_, m) => ({
      month: m + 1,
      label: new Date(y, m).toLocaleString('fr-FR', { month: 'short' }),
      amount: 0,
    }))
    for (const inv of invoicesPaid) {
      const m = new Date(inv.issueDate!).getMonth()
      revenueByMonth[m].amount += Number(inv.paidAmount ?? inv.totalAmount)
    }

    // Factures en attente
    const invoicesPending = await this.prisma.invoice.aggregate({
      where: { type: 'FACTURE', status: { in: ['ENVOYEE', 'RETARD'] } },
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

    // Dépenses manuelles (saisies depuis la compta)
    const manualExpenses = await this.prisma.auditLog.findMany({
      where: {
        entity: 'ManualExpense',
        createdAt: { gte: startOfYear, lt: endOfYear },
      },
      select: { newData: true },
    })
    const totalManualExpenses = manualExpenses.reduce((s, e) => {
      const data = e.newData as any
      return s + Number(data?.amount ?? 0)
    }, 0)

    const totalExpenses = totalSalaries + totalFuel + totalMaintenance + totalManualExpenses
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
        manual: totalManualExpenses,
      },
      netResult,
      margin: totalRevenue > 0 ? Math.round((netResult / totalRevenue) * 100) : 0,
    }
  }

  // ── Journal comptable (écritures en double-partie) ─────────────
  async getJournal(filters?: { year?: number; month?: number; type?: string }) {
    const y = filters?.year ?? new Date().getFullYear()
    const m = filters?.month
    const startDate = m ? new Date(y, m - 1, 1) : new Date(y, 0, 1)
    const endDate   = m ? new Date(y, m, 1) : new Date(y + 1, 0, 1)

    const entries: any[] = []

    // 1. Factures émises → Vente (reconnaissance du revenu)
    //    Débit: 4111 — Clients  /  Crédit: 7011 — Ventes prestations
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
          nature: 'Vente de prestation — la facture est émise au client (pas encore d\'argent en banque)',
          debitAccount: '4111 — Clients',
          creditAccount: '7011 — Ventes prestations sécurité',
          amount: Number(inv.totalAmount),
          cashImpact: 0,
          status: inv.status,
        })
      }
    }

    // 2. Encaissements → Paiement reçu d'un client (inclut acomptes)
    //    Débit: 5211 — Banque  /  Crédit: 4111 — Clients
    if (!filters?.type || filters.type === 'ENCAISSEMENT') {
      const payments = await this.prisma.payment.findMany({
        where: {
          paidAt: { gte: startDate, lt: endDate },
          invoice: { type: 'FACTURE' },
        },
        include: { invoice: { include: { client: { select: { name: true } } } } },
        orderBy: { paidAt: 'asc' },
      })
      for (const pay of payments) {
        const amt = Number(pay.amount)
        const inv = pay.invoice
        const isPartial = inv.status === 'PARTIELLEMENT_PAYEE'
        entries.push({
          id: `PAY-${pay.id}`,
          date: pay.paidAt,
          type: 'ENCAISSEMENT',
          reference: inv.reference,
          description: `Encaissement ${inv.reference} — ${inv.client?.name ?? 'N/A'}`,
          nature: isPartial
            ? 'Acompte — paiement partiel reçu du client (le reste reste en créance)'
            : 'Encaissement — le client a payé, l\'argent entre en banque',
          debitAccount: '5211 — Banque',
          creditAccount: '4111 — Clients',
          amount: amt,
          cashImpact: amt,
          status: inv.status,
        })
      }
    }

    // 3. Salaires → Charge de personnel
    //    Débit: 6611 — Rémunérations  /  Crédit: 5211 — Banque
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
        const amt = Number(p.totalBrut)
        entries.push({
          id: `SAL-${p.id}`,
          date: p.processedAt ?? new Date(p.year, p.month - 1, 28),
          type: 'SALAIRE',
          reference: `PAIE-${String(p.month).padStart(2, '0')}/${p.year}`,
          description: `Masse salariale ${String(p.month).padStart(2, '0')}/${p.year}`,
          nature: 'Charge salariale — paiement des salaires (sortie de banque)',
          debitAccount: '6611 — Rémunérations du personnel',
          creditAccount: '5211 — Banque',
          amount: amt,
          cashImpact: -amt,
          status: p.status,
        })
      }
    }

    // 4. Carburant → Charge d'exploitation
    //    Débit: 6055 — Carburant  /  Crédit: 5211 — Banque
    if (!filters?.type || filters.type === 'CARBURANT') {
      const fuels = await this.prisma.fuelLog.findMany({
        where: { date: { gte: startDate, lt: endDate } },
        include: { vehicle: { select: { plateNumber: true } } },
        orderBy: { date: 'asc' },
      })
      for (const f of fuels) {
        const amt = Number(f.totalCost)
        entries.push({
          id: `FUEL-${f.id}`,
          date: f.date,
          type: 'CARBURANT',
          reference: f.vehicle.plateNumber,
          description: `Carburant ${f.vehicle.plateNumber} (${f.liters}L)`,
          nature: 'Charge carburant — achat de carburant (sortie de banque)',
          debitAccount: '6055 — Fournitures carburant',
          creditAccount: '5211 — Banque',
          amount: amt,
          cashImpact: -amt,
          status: 'PAYE',
        })
      }
    }

    // 5. Maintenance → Charge d'exploitation
    //    Débit: 6155 — Entretien véhicules  /  Crédit: 5211 — Banque
    if (!filters?.type || filters.type === 'MAINTENANCE') {
      const maints = await this.prisma.maintenance.findMany({
        where: { startDate: { gte: startDate, lt: endDate } },
        include: { vehicle: { select: { plateNumber: true } } },
        orderBy: { startDate: 'asc' },
      })
      for (const m of maints) {
        if (!m.cost) continue
        const amt = Number(m.cost)
        entries.push({
          id: `MAINT-${m.id}`,
          date: m.startDate,
          type: 'MAINTENANCE',
          reference: m.vehicle.plateNumber,
          description: `Maintenance ${m.type} — ${m.vehicle.plateNumber}`,
          nature: 'Charge maintenance — entretien du véhicule (sortie de banque)',
          debitAccount: '6155 — Entretien véhicules',
          creditAccount: '5211 — Banque',
          amount: amt,
          cashImpact: -amt,
          status: 'ENREGISTRE',
        })
      }
    }

    // 6. Dépenses manuelles → Charge diverse
    //    Débit: [compte saisi]  /  Crédit: 5211 — Banque
    if (!filters?.type || filters.type === 'DEPENSE') {
      const manualExps = await this.prisma.auditLog.findMany({
        where: {
          entity: 'ManualExpense',
          createdAt: { gte: startDate, lt: endDate },
        },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'asc' },
      })
      for (const exp of manualExps) {
        const data = exp.newData as any
        const amt = Number(data?.amount ?? 0)
        entries.push({
          id: `EXP-${exp.id}`,
          date: data?.date ? new Date(data.date) : exp.createdAt,
          type: 'DEPENSE',
          reference: data?.reference ?? '—',
          description: data?.description ?? 'Dépense',
          nature: 'Dépense manuelle — charge saisie manuellement (sortie de banque)',
          debitAccount: data?.account ?? '6581 — Charges diverses',
          creditAccount: '5211 — Banque',
          amount: amt,
          cashImpact: -amt,
          status: 'ENREGISTRE',
        })
      }
    }

    // Trier par date (du plus récent au plus ancien)
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    // Trésorerie cumulée (impact cash uniquement, calculée du plus ancien au plus récent)
    const chronological = [...entries].reverse()
    let treasury = 0
    for (const e of chronological) {
      treasury += e.cashImpact
      e.treasury = treasury
    }

    const totalAmount = entries.reduce((s, e) => s + e.amount, 0)
    const totalCashIn = entries.filter(e => e.cashImpact > 0).reduce((s, e) => s + e.cashImpact, 0)
    const totalCashOut = entries.filter(e => e.cashImpact < 0).reduce((s, e) => s + Math.abs(e.cashImpact), 0)

    return {
      year: y,
      month: m,
      entries,
      totals: {
        amount: totalAmount,
        cashIn: totalCashIn,
        cashOut: totalCashOut,
        netCash: treasury,
      },
    }
  }

  // ── Enregistrer un paiement sur une facture ─────────────
  async registerPayment(invoiceId: string, data: { amount?: number; paymentDate?: string; paymentMethod?: string; reference?: string }, userId?: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } })
    if (!invoice) throw new Error('Facture introuvable')

    const paymentAmount = data.amount ?? Number(invoice.totalAmount)
    const paidAt = data.paymentDate ? new Date(data.paymentDate) : new Date()

    // Create a Payment record
    const payment = await this.prisma.payment.create({
      data: {
        invoiceId,
        amount: paymentAmount,
        method: data.paymentMethod ?? 'VIREMENT',
        reference: data.reference ?? null,
        paidAt,
        recordedBy: userId ?? null,
      },
    })

    // Calculate cumulative paid amount from all payments
    const allPayments = await this.prisma.payment.aggregate({
      where: { invoiceId },
      _sum: { amount: true },
    })
    const cumulativePaid = Number(allPayments._sum.amount ?? 0)
    const totalAmount = Number(invoice.totalAmount)

    // Determine new status based on cumulative paid amount
    const newStatus = cumulativePaid >= totalAmount ? 'PAYEE' : 'PARTIELLEMENT_PAYEE'

    // Update invoice
    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: newStatus,
        paidAt: newStatus === 'PAYEE' ? paidAt : invoice.paidAt,
        paidAmount: cumulativePaid,
        paymentMethod: data.paymentMethod ? (data.paymentMethod as any) : invoice.paymentMethod,
      },
    })

    // Record in invoice history
    const isPartial = newStatus === 'PARTIELLEMENT_PAYEE'
    await this.prisma.invoiceHistory.create({
      data: {
        invoiceId,
        action: 'PAIEMENT',
        details: isPartial
          ? `Acompte de ${paymentAmount} XOF enregistré (${data.paymentMethod ?? 'ESPECE'}). Reste à payer: ${totalAmount - cumulativePaid} XOF`
          : `Paiement de ${paymentAmount} XOF enregistré (${data.paymentMethod ?? 'ESPECE'}). Facture soldée.`,
        performedBy: userId ?? 'system',
      },
    })

    // Auto-credit treasury account
    try {
      await this.treasury.creditFromPayment(payment.id, data.paymentMethod ?? 'ESPECE', paymentAmount, data.reference)
    } catch (e) {
      // Treasury credit is non-blocking — payment still succeeds
    }

    return { payment, invoice: updated }
  }

  // ── Factures impayées ──────────────────────────────────────
  async getUnpaidInvoices() {
    return this.prisma.invoice.findMany({
      where: { status: { in: ['ENVOYEE', 'RETARD', 'PARTIELLEMENT_PAYEE'] }, type: 'FACTURE' },
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
      where: { type: 'FACTURE', status: 'PAYEE', paidAt: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) } },
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

    // Décaissements manuels (saisis depuis la compta)
    const manualExps = await this.prisma.auditLog.findMany({
      where: {
        entity: 'ManualExpense',
        createdAt: { gte: new Date(y, 0, 1), lt: new Date(y + 1, 0, 1) },
      },
      select: { newData: true, createdAt: true },
    })
    for (const exp of manualExps) {
      const data = exp.newData as any
      const date = data?.date ? new Date(data.date) : exp.createdAt
      if (date.getFullYear() === y) {
        months[date.getMonth()].decaissements += Number(data?.amount ?? 0)
      }
    }

    // Solde cumulé
    let cumul = 0
    for (const m of months) {
      m.solde = m.encaissements - m.decaissements
      cumul += m.solde
    }

    return { year: y, months, cumulativeSolde: cumul }
  }

  // ── Plan comptable (Chart of Accounts) ───────────────────
  async getAccounts() {
    return this.prisma.accountingAccount.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    })
  }

  async createAccount(data: { code: string; label: string }) {
    return this.prisma.accountingAccount.create({
      data: { code: data.code, label: data.label },
    })
  }

  async updateAccount(id: string, data: { code?: string; label?: string }) {
    return this.prisma.accountingAccount.update({
      where: { id },
      data: { ...(data.code && { code: data.code }), ...(data.label && { label: data.label }) },
    })
  }

  async deleteAccount(id: string) {
    return this.prisma.accountingAccount.update({
      where: { id },
      data: { isActive: false },
    })
  }

  async resetAccounts() {
    const defaults = [
      { code: '411', label: 'Clients', sortOrder: 1 },
      { code: '4111', label: 'Clients — Créances commerciales', sortOrder: 2 },
      { code: '422', label: 'Personnel — Avances et acomptes', sortOrder: 3 },
      { code: '431', label: 'Sécurité sociale', sortOrder: 4 },
      { code: '441', label: 'État — Impôts et taxes', sortOrder: 5 },
      { code: '521', label: 'Banque', sortOrder: 6 },
      { code: '5211', label: 'Banque — Compte principal', sortOrder: 7 },
      { code: '531', label: 'Caisse', sortOrder: 8 },
      { code: '601', label: 'Achats de matières et fournitures', sortOrder: 9 },
      { code: '602', label: 'Achats de produits semi-finis', sortOrder: 10 },
      { code: '605', label: 'Autres achats', sortOrder: 11 },
      { code: '6051', label: 'Fournitures non stockées (eau, électricité)', sortOrder: 12 },
      { code: '6055', label: 'Fournitures carburant', sortOrder: 13 },
      { code: '6061', label: 'Fournitures de bureau', sortOrder: 14 },
      { code: '6064', label: 'Fournitures administratives', sortOrder: 15 },
      { code: '613', label: 'Locations', sortOrder: 16 },
      { code: '6132', label: 'Locations de terrains et bâtiments', sortOrder: 17 },
      { code: '6135', label: 'Locations de matériel et outillage', sortOrder: 18 },
      { code: '615', label: 'Entretien et réparations', sortOrder: 19 },
      { code: '6155', label: 'Entretien et réparation des véhicules', sortOrder: 20 },
      { code: '616', label: 'Assurances', sortOrder: 21 },
      { code: '6161', label: 'Assurance multirisque', sortOrder: 22 },
      { code: '6162', label: 'Assurance responsabilité civile', sortOrder: 23 },
      { code: '6163', label: 'Assurance flotte automobile', sortOrder: 24 },
      { code: '621', label: 'Transports de biens et personnes', sortOrder: 25 },
      { code: '625', label: 'Déplacements, missions et réceptions', sortOrder: 26 },
      { code: '626', label: 'Frais postaux et de télécommunications', sortOrder: 27 },
      { code: '6261', label: 'Téléphone', sortOrder: 28 },
      { code: '6262', label: 'Internet et communications', sortOrder: 29 },
      { code: '627', label: 'Services bancaires', sortOrder: 30 },
      { code: '6271', label: 'Frais bancaires', sortOrder: 31 },
      { code: '631', label: 'Impôts et taxes', sortOrder: 32 },
      { code: '6311', label: 'Impôts et taxes directs', sortOrder: 33 },
      { code: '633', label: 'Impôts et taxes indirects', sortOrder: 34 },
      { code: '641', label: 'Rémunérations du personnel', sortOrder: 35 },
      { code: '6411', label: 'Salaires de base', sortOrder: 36 },
      { code: '6412', label: 'Primes et gratifications', sortOrder: 37 },
      { code: '6413', label: 'Heures supplémentaires', sortOrder: 38 },
      { code: '645', label: 'Charges sociales sur rémunérations', sortOrder: 39 },
      { code: '6451', label: 'Cotisations CNPS', sortOrder: 40 },
      { code: '651', label: 'Subventions et charges diverses', sortOrder: 41 },
      { code: '658', label: 'Charges diverses', sortOrder: 42 },
      { code: '6581', label: 'Charges diverses d\'exploitation', sortOrder: 43 },
      { code: '661', label: 'Charges de personnel', sortOrder: 44 },
      { code: '6611', label: 'Rémunérations du personnel', sortOrder: 45 },
      { code: '701', label: 'Ventes de produits finis', sortOrder: 46 },
      { code: '706', label: 'Prestations de services', sortOrder: 47 },
      { code: '7061', label: 'Prestations de gardiennage', sortOrder: 48 },
      { code: '7062', label: 'Prestations de sécurité électronique', sortOrder: 49 },
      { code: '7063', label: 'Prestations de protection rapprochée', sortOrder: 50 },
      { code: '7064', label: 'Prestations de surveillance événementielle', sortOrder: 51 },
      { code: '7065', label: 'Prestations d\'installation et maintenance', sortOrder: 52 },
      { code: '7011', label: 'Ventes prestations sécurité', sortOrder: 53 },
    ]

    // Delete all existing accounts, then recreate
    await this.prisma.accountingAccount.deleteMany({})
    await this.prisma.accountingAccount.createMany({ data: defaults })

    return { count: defaults.length }
  }
}
