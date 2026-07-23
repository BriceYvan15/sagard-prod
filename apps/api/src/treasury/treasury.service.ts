import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class TreasuryService {
  constructor(private prisma: PrismaService) {}

  // ── Seed default treasury accounts if none exist ──────────
  async seedDefaults() {
    const count = await this.prisma.treasuryAccount.count()
    if (count > 0) return { seeded: false, count }

    const defaults = [
      { name: 'Banque NSIA',      type: 'BANQUE',       bankName: 'NSIA',     paymentMethods: ['CHEQUE_NSIA', 'VIREMENT_NSIA'] },
      { name: 'Banque BOA',       type: 'BANQUE',       bankName: 'BOA',      paymentMethods: ['CHEQUE_BOA', 'VIREMENT_BOA'] },
      { name: 'Banque Ecobank',   type: 'BANQUE',       bankName: 'Ecobank',  paymentMethods: ['CHEQUE_ECOBANK', 'VIREMENT_ECOBANK'] },
      { name: 'Wave',             type: 'MOBILE_MONEY', bankName: 'Wave',     paymentMethods: ['WAVE'] },
      { name: 'Orange Money',     type: 'MOBILE_MONEY', bankName: 'Orange',   paymentMethods: ['ORANGE_MONEY'] },
      { name: 'Djamo',            type: 'MOBILE_MONEY', bankName: 'Djamo',    paymentMethods: ['DJAMO'] },
      { name: 'Caisse',           type: 'CAISSE',       bankName: null,       paymentMethods: ['ESPECE'] },
    ]

    for (const d of defaults) {
      await this.prisma.treasuryAccount.create({ data: d })
    }
    return { seeded: true, count: defaults.length }
  }

  // ── List all treasury accounts ───────────────────────────
  async findAll() {
    return this.prisma.treasuryAccount.findMany({
      where: { isActive: true },
      orderBy: { type: 'asc' },
      include: {
        _count: { select: { transactions: true } },
      },
    })
  }

  // ── Get one account with recent transactions ─────────────
  async findOne(id: string) {
    const account = await this.prisma.treasuryAccount.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            payment: {
              include: {
                invoice: {
                  select: { reference: true, client: { select: { name: true } }, lead: { select: { companyName: true, contactName: true } } },
                },
              },
            },
          },
        },
      },
    })
    if (!account) throw new NotFoundException('Compte de trésorerie introuvable')
    return account
  }

  // ── Create a new treasury account ────────────────────────
  async create(data: { name: string; type: string; bankName?: string; accountNumber?: string; paymentMethods?: string[] }) {
    return this.prisma.treasuryAccount.create({
      data: {
        name: data.name,
        type: data.type,
        bankName: data.bankName ?? null,
        accountNumber: data.accountNumber ?? null,
        paymentMethods: data.paymentMethods ?? [],
      },
    })
  }

  // ── Update a treasury account ────────────────────────────
  async update(id: string, data: { name?: string; bankName?: string; accountNumber?: string; paymentMethods?: string[]; isActive?: boolean }) {
    await this.findOne(id)
    return this.prisma.treasuryAccount.update({ where: { id }, data })
  }

  // ── Find account by payment method ───────────────────────
  async findByPaymentMethod(method: string) {
    const accounts = await this.prisma.treasuryAccount.findMany({
      where: { isActive: true, paymentMethods: { has: method } },
    })
    return accounts[0] ?? null
  }

  // ── Credit treasury account when a payment is registered ─
  async creditFromPayment(paymentId: string, method: string, amount: number, reference?: string) {
    const account = await this.findByPaymentMethod(method)
    if (!account) return null

    const tx = await this.prisma.treasuryTransaction.create({
      data: {
        treasuryAccountId: account.id,
        type: 'CREDIT',
        amount,
        description: `Paiement reçu (${method})`,
        paymentId,
        reference,
      },
    })

    await this.prisma.treasuryAccount.update({
      where: { id: account.id },
      data: { balance: { increment: amount } },
    })

    await this.prisma.payment.update({
      where: { id: paymentId },
      data: { treasuryAccountId: account.id },
    })

    return { account, tx }
  }

  // ── Manual debit (e.g. expense, withdrawal) ──────────────
  async debit(id: string, data: { amount: number; description?: string; reference?: string }) {
    const account = await this.findOne(id)
    const amt = Number(data.amount)
    if (amt <= 0) throw new BadRequestException('Le montant doit être positif')

    const tx = await this.prisma.treasuryTransaction.create({
      data: {
        treasuryAccountId: id,
        type: 'DEBIT',
        amount: amt,
        description: data.description ?? 'Débit manuel',
        reference: data.reference ?? null,
      },
    })

    await this.prisma.treasuryAccount.update({
      where: { id },
      data: { balance: { decrement: amt } },
    })

    return { account: await this.findOne(id), tx }
  }

  // ── Manual credit (e.g. deposit, other income) ───────────
  async manualCredit(id: string, data: { amount: number; description?: string; reference?: string }) {
    const account = await this.findOne(id)
    const amt = Number(data.amount)
    if (amt <= 0) throw new BadRequestException('Le montant doit être positif')

    const tx = await this.prisma.treasuryTransaction.create({
      data: {
        treasuryAccountId: id,
        type: 'CREDIT',
        amount: amt,
        description: data.description ?? 'Crédit manuel',
        reference: data.reference ?? null,
      },
    })

    await this.prisma.treasuryAccount.update({
      where: { id },
      data: { balance: { increment: amt } },
    })

    return { account: await this.findOne(id), tx }
  }

  // ── Transfer between accounts ────────────────────────────
  async transfer(fromId: string, toId: string, amount: number, description?: string) {
    const amt = Number(amount)
    if (amt <= 0) throw new BadRequestException('Le montant doit être positif')
    if (fromId === toId) throw new BadRequestException('Impossible de transférer vers le même compte')

    const fromAccount = await this.findOne(fromId)
    const toAccount = await this.findOne(toId)

    if (Number(fromAccount.balance) < amt) throw new BadRequestException('Solde insuffisant')

    return this.prisma.$transaction([
      // Debit source
      this.prisma.treasuryTransaction.create({
        data: {
          treasuryAccountId: fromId,
          type: 'DEBIT',
          amount: amt,
          description: description ?? `Transfert vers ${toAccount.name}`,
        },
      }),
      // Credit destination
      this.prisma.treasuryTransaction.create({
        data: {
          treasuryAccountId: toId,
          type: 'CREDIT',
          amount: amt,
          description: description ?? `Transfert depuis ${fromAccount.name}`,
        },
      }),
      // Update balances
      this.prisma.treasuryAccount.update({
        where: { id: fromId },
        data: { balance: { decrement: amt } },
      }),
      this.prisma.treasuryAccount.update({
        where: { id: toId },
        data: { balance: { increment: amt } },
      }),
    ])
  }

  // ── Get all transactions across all accounts ─────────────
  async getAllTransactions(accountId?: string, limit = 100) {
    return this.prisma.treasuryTransaction.findMany({
      where: accountId ? { treasuryAccountId: accountId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        treasuryAccount: { select: { id: true, name: true, type: true } },
        payment: {
          include: {
            invoice: {
              select: { reference: true, client: { select: { name: true } }, lead: { select: { companyName: true, contactName: true } } },
            },
          },
        },
      },
    })
  }
}
