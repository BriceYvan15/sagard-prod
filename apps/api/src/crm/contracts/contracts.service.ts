import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

type ContractStatus = 'BROUILLON' | 'DEVIS' | 'PROFORMA' | 'CONFIRME' | 'ACTIF' | 'SUSPENDU' | 'RESILIE' | 'EXPIRE'

const ALLOWED_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  BROUILLON: ['DEVIS', 'PROFORMA', 'CONFIRME', 'RESILIE'],
  DEVIS:     ['PROFORMA', 'CONFIRME', 'RESILIE'],
  PROFORMA:  ['CONFIRME', 'RESILIE'],
  CONFIRME:  ['ACTIF', 'RESILIE'],
  ACTIF:     ['SUSPENDU', 'RESILIE', 'EXPIRE'],
  SUSPENDU:  ['ACTIF', 'RESILIE'],
  RESILIE:   [],
  EXPIRE:    [],
}

@Injectable()
export class ContractsService {
  constructor(private prisma: PrismaService) {}

  // Convert Prisma Decimal/BigInt to plain JSON-safe objects
  private serialize(obj: any): any {
    return JSON.parse(JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? Number(value) : value
    ))
  }

  async findAll(filters?: { clientId?: string; status?: string }) {
    try {
      const results = await this.prisma.clientContract.findMany({
        where: {
          ...(filters?.clientId && { clientId: filters.clientId }),
          ...(filters?.status   && { status: filters.status as any }),
        },
        include: {
          client: { select: { id: true, name: true } },
          sites:  { include: { site: { select: { id: true, name: true, district: true } } } },
          site:   { select: { id: true, name: true, district: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return results.map(r => this.serialize(r))
    } catch (err) {
      console.error('CONTRACT findAll ERROR:', err)
      throw err
    }
  }

  async findOne(id: string) {
    const contract = await this.prisma.clientContract.findUnique({
      where: { id },
      include: {
        client: true,
        sites:  true,
        invoices: { orderBy: { createdAt: 'desc' }, take: 12 },
        history:  { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    })
    if (!contract) throw new NotFoundException('Contrat introuvable')
    return contract
  }

  private async generateReference() {
    const year  = new Date().getFullYear()
    const count = await this.prisma.clientContract.count({
      where: { reference: { startsWith: `CTR-${year}-` } },
    })
    return `CTR-${year}-${String(count + 1).padStart(4, '0')}`
  }

  private computeHoursMonth(nbAgents: number, nbShifts: 'ONE' | 'TWO' | 'THREE') {
    const shifts = nbShifts === 'THREE' ? 3 : nbShifts === 'TWO' ? 2 : 1
    return nbAgents * shifts * 8 * 30
  }

  private computeDurationMonths(start: Date, end?: Date | null) {
    if (!end) return null
    const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
    return Math.max(0, months)
  }

  async create(data: {
    clientId: string;
    title?: string;
    contractType?: string;        // GARDIENNAGE_STATIQUE | PATROUILLE_MOBILE | ...
    type?: string;                // libellé libre (compat)
    description?: string;
    signatureDate?: Date;
    startDate: Date;
    endDate?: Date;
    autoRenew?: boolean;
    noticeDays?: number;
    monthlyAmount: number;
    setupAmount?: number;
    currency?: string;            // XOF | EUR | USD
    invoicingFrequency?: string;  // MENSUELLE | TRIMESTRIELLE | SEMESTRIELLE | ANNUELLE
    paymentTermDays?: number;
    nbAgentsRequired: number;
    nbShifts?: string;            // ONE | TWO | THREE
    siteId?: string;              // Site principal (m2o)
    siteIds?: string[];           // Sites additionnels (m2m)
    assignedUserId?: string;      // Chargé d'affaires
    createdById?: string;
  }) {
    try {
      const reference = await this.generateReference()
      const nbShifts  = (data.nbShifts as 'ONE' | 'TWO' | 'THREE') ?? 'ONE'
      const nbHoursMonth = this.computeHoursMonth(data.nbAgentsRequired ?? 0, nbShifts)
      const startDate = new Date(data.startDate)
      const endDate = data.endDate ? new Date(data.endDate) : null
      const signatureDate = data.signatureDate ? new Date(data.signatureDate) : null
      const durationMonths = this.computeDurationMonths(startDate, endDate)

      const { siteIds, siteId, ...rest } = data
      const resolvedSiteId = siteId || null
      const allSiteIds = siteIds?.length ? siteIds : (resolvedSiteId ? [resolvedSiteId] : [])

      const contract = await this.prisma.clientContract.create({
        data: {
          reference,
          title: rest.title,
          clientId: rest.clientId,
          contractType: (rest.contractType as any) ?? 'GARDIENNAGE_STATIQUE',
          type: rest.type || null,
          description: rest.description || null,
          signatureDate,
          startDate,
          endDate,
          durationMonths,
          autoRenew: rest.autoRenew ?? false,
          noticeDays: rest.noticeDays ?? 30,
          monthlyAmount: rest.monthlyAmount,
          setupAmount: rest.setupAmount ?? 0,
          currency: rest.currency ?? 'XOF',
          invoicingFrequency: (rest.invoicingFrequency as any) ?? 'MENSUELLE',
          paymentTermDays: rest.paymentTermDays ?? 30,
          nbAgentsRequired: rest.nbAgentsRequired ?? 0,
          nbShifts,
          nbHoursMonth,
          siteId: resolvedSiteId,
          assignedUserId: rest.assignedUserId || null,
          status: 'BROUILLON',
          createdById: rest.createdById || null,
          ...(allSiteIds.length && { sites: { create: allSiteIds.map(sid => ({ siteId: sid, startDate })) } }),
        },
        include: { client: { select: { name: true } }, sites: { include: { site: true } }, site: true },
      })

      await this.prisma.contractHistory.create({
        data: { contractId: contract.id, action: 'CREATED', details: 'Contrat créé en brouillon', performedBy: rest.createdById || 'system' },
      })
      return this.serialize(contract)
    } catch (err) {
      console.error('CONTRACT CREATE ERROR:', err)
      throw err
    }
  }

  async update(id: string, data: Partial<{
    title: string; contractType: string; type: string; description: string;
    endDate: Date; monthlyAmount: number; setupAmount: number;
    nbAgentsRequired: number; nbShifts: string; status: string;
    invoicingFrequency: string; autoRenew: boolean; noticeDays: number;
    paymentTermDays: number;
  }>) {
    const current = await this.findOne(id)
    const merged = {
      nbAgents: data.nbAgentsRequired ?? current.nbAgentsRequired,
      nbShifts: (data.nbShifts as any) ?? current.nbShifts,
    }
    const recomputed: any = {}
    if (data.nbAgentsRequired !== undefined || data.nbShifts !== undefined) {
      recomputed.nbHoursMonth = this.computeHoursMonth(merged.nbAgents, merged.nbShifts)
    }
    if (data.endDate !== undefined) {
      recomputed.durationMonths = this.computeDurationMonths(current.startDate, data.endDate)
    }
    return this.prisma.clientContract.update({ where: { id }, data: { ...(data as any), ...recomputed } })
  }

  // ─── Transitions de statut (workflow Odoo) ───
  private async transition(id: string, target: ContractStatus, performedBy: string, details?: string) {
    const c = await this.findOne(id)
    const allowed = ALLOWED_TRANSITIONS[c.status as ContractStatus] ?? []
    if (!allowed.includes(target)) {
      throw new BadRequestException(`Transition interdite : ${c.status} → ${target}`)
    }
    const updated = await this.prisma.clientContract.update({
      where: { id }, data: { status: target as any },
    })
    await this.prisma.contractHistory.create({
      data: { contractId: id, action: `STATUS_${target}`, details: details ?? `Passage à ${target}`, performedBy },
    })
    return updated
  }

  toQuotation(id: string, userId = 'system') { return this.transition(id, 'DEVIS', userId, 'Passé en devis') }
  toProforma (id: string, userId = 'system') { return this.transition(id, 'PROFORMA', userId, 'Passé en proforma') }
  confirm    (id: string, userId = 'system') { return this.transition(id, 'CONFIRME', userId, 'Contrat confirmé') }
  suspend    (id: string, userId = 'system') { return this.transition(id, 'SUSPENDU', userId, 'Contrat suspendu') }
  terminate  (id: string, userId = 'system') { return this.transition(id, 'RESILIE', userId, 'Contrat résilié') }

  async activate(id: string, userId = 'system') {
    // Comme Odoo : exiger au moins une affectation active avant activation.
    const deployments = await this.prisma.agentDeployment.findMany({
      where: { isActive: true, site: { contracts: { some: { contractId: id } } } },
      take: 1,
    })
    if (deployments.length === 0) {
      throw new BadRequestException(
        "Aucune affectation active sur ce contrat. Veuillez affecter des agents avant l'activation.",
      )
    }
    return this.transition(id, 'ACTIF', userId, 'Contrat activé')
  }

  async renew(id: string, newEndDate: Date, newAmount?: number, userId = 'system') {
    const contract = await this.findOne(id)
    const updated = await this.prisma.clientContract.update({
      where: { id },
      data: {
        startDate: new Date(),
        endDate:   newEndDate,
        durationMonths: this.computeDurationMonths(new Date(), newEndDate),
        ...(newAmount && { monthlyAmount: newAmount }),
        status: 'ACTIF',
      },
    })
    await this.prisma.contractHistory.create({
      data: { contractId: id, action: 'RENEWED', details: `Renouvelé jusqu'au ${newEndDate.toISOString().slice(0, 10)}`, performedBy: userId },
    })
    return updated
  }

  // ─── Génération de documents commerciaux depuis le contrat (équivalent action_create_quotation/invoice d'Odoo) ───
  async createQuotationFromContract(id: string, userId = 'system') {
    const c = await this.findOne(id)
    const count = await this.prisma.invoice.count()
    const reference = `DEV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + (c.paymentTermDays ?? 30))
    const subtotal = Number(c.monthlyAmount)
    const totalAmount = subtotal

    const devis = await this.prisma.invoice.create({
      data: {
        reference, type: 'DEVIS', status: 'BROUILLON',
        clientId: c.clientId, contractId: c.id,
        subtotal, taxRate: 0, taxAmount: 0, totalAmount,
        dueDate, currency: c.currency,
        notes: `Devis pour ${c.title ?? c.reference}`,
        lines: { create: [{ code: 'SEC-SVC', description: c.title ?? 'Prestation sécurité', quantity: 1, unitPrice: subtotal, total: subtotal }] },
        createdById: userId === 'system' ? null : userId,
      },
    })
    await this.prisma.contractHistory.create({
      data: { contractId: id, action: 'QUOTATION_CREATED', details: `Devis ${reference} créé`, performedBy: userId },
    })
    return devis
  }

  async createInvoiceFromContract(id: string, userId = 'system') {
    const c = await this.findOne(id)
    const count = await this.prisma.invoice.count()
    const reference = `FAC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + (c.paymentTermDays ?? 30))
    const subtotal = Number(c.monthlyAmount)
    const totalAmount = subtotal

    const invoice = await this.prisma.invoice.create({
      data: {
        reference, type: 'FACTURE', status: 'BROUILLON',
        clientId: c.clientId, contractId: c.id,
        subtotal, taxRate: 0, taxAmount: 0, totalAmount,
        dueDate, currency: c.currency,
        notes: `Facture pour ${c.title ?? c.reference}`,
        lines: { create: [{ code: 'SEC-SVC', description: c.title ?? 'Prestation sécurité', quantity: 1, unitPrice: subtotal, total: subtotal }] },
        createdById: userId === 'system' ? null : userId,
      },
    })
    await this.prisma.contractHistory.create({
      data: { contractId: id, action: 'INVOICE_CREATED', details: `Facture ${reference} créée`, performedBy: userId },
    })
    return invoice
  }

  async getExpiringContracts(daysAhead = 30) {
    const limit = new Date()
    limit.setDate(limit.getDate() + daysAhead)
    return this.prisma.clientContract.findMany({
      where: { status: 'ACTIF', endDate: { lte: limit } },
      include: { client: { select: { name: true } } },
      orderBy: { endDate: 'asc' },
    })
  }
}
