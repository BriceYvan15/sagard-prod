import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { startOfDay, subDays, startOfMonth, format } from 'date-fns'

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const today      = startOfDay(new Date())
    const monthStart = startOfMonth(new Date())

    const [
      clients, contracts, sites, agentsOnDuty,
      overdueInvoices, todayPointages,
      overdueInvoicesList, todayPointagesList,
      pendingLeaves, availableEquipments,
    ] = await Promise.all([
      this.prisma.client.count({ where: { status: 'ACTIF' } }),
      this.prisma.clientContract.count({ where: { status: 'ACTIF' } }),
      this.prisma.site.count({ where: { status: 'ACTIF' } }),
      this.prisma.agent.count({ where: { status: 'EN_POSTE' } }),
      this.prisma.invoice.count({ where: { status: 'RETARD' } }),
      this.prisma.pointage.count({ where: { checkInTime: { gte: today } } }),
      this.prisma.invoice.findMany({
        where: { status: 'RETARD' },
        include: { client: { select: { name: true } } },
        orderBy: { dueDate: 'asc' },
        take: 5,
      }),
      this.prisma.pointage.findMany({
        where: { checkInTime: { gte: today } },
        include: {
          agent: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { checkInTime: 'desc' },
        take: 8,
      }),
      this.prisma.leave.count({ where: { status: 'EN_ATTENTE' } }),
      this.prisma.equipment.count({ where: { status: 'DISPONIBLE' } }),
    ])

    const monthlyRevenue = await this.getMonthlyRevenue()
    const weeklyPointages = await this.getWeeklyPointages()

    return {
      clients, contracts, sites, agentsOnDuty,
      overdueInvoices, todayPointages,
      overdueInvoicesList, todayPointagesList,
      pendingLeaves, availableEquipments,
      monthlyRevenue, weeklyPointages,
    }
  }

  private async getMonthlyRevenue() {
    const months = []
    for (let i = 5; i >= 0; i--) {
      const d     = new Date()
      d.setMonth(d.getMonth() - i)
      const start = startOfMonth(d)
      const end   = new Date(d.getFullYear(), d.getMonth() + 1, 1)

      const agg = await this.prisma.invoice.aggregate({
        _sum: { totalAmount: true },
        where: { type: 'FACTURE', status: 'PAYEE', paidAt: { gte: start, lt: end } },
      })

      months.push({ month: format(start, 'MMM yy'), amount: Number(agg._sum.totalAmount ?? 0) })
    }
    return months
  }

  private async getWeeklyPointages() {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d     = subDays(new Date(), i)
      const start = startOfDay(d)
      const end   = new Date(start.getTime() + 86_400_000)

      const count = await this.prisma.pointage.count({ where: { checkInTime: { gte: start, lt: end } } })
      days.push({ day: format(start, 'EEE'), count })
    }
    return days
  }
}
