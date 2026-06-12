import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class StockService {
  constructor(private prisma: PrismaService) {}

  // ── Équipements ──────────────────────────────────────────────────────
  async getEquipments(filters?: { status?: string; category?: string }) {
    return this.prisma.equipment.findMany({
      where: {
        ...(filters?.status   && { status: filters.status as any }),
        ...(filters?.category && { category: { contains: filters.category, mode: 'insensitive' } }),
      },
      include: {
        assignments: {
          where: { returnedAt: null },
          include: { agent: { include: { user: { select: { firstName: true, lastName: true } } } } },
        },
      },
      orderBy: { code: 'asc' },
    })
  }

  async createEquipment(data: { code: string; name: string; category: string; description?: string; purchaseDate?: Date; purchasePrice?: number }) {
    const exists = await this.prisma.equipment.findUnique({ where: { code: data.code } })
    if (exists) throw new NotFoundException('Code équipement déjà utilisé')
    return this.prisma.equipment.create({ data: { ...data, status: 'DISPONIBLE' } })
  }

  async updateEquipment(id: string, data: any) {
    return this.prisma.equipment.update({ where: { id }, data })
  }

  async getEquipmentStats() {
    const [total, available, assigned, maintenance] = await Promise.all([
      this.prisma.equipment.count(),
      this.prisma.equipment.count({ where: { status: 'DISPONIBLE' } }),
      this.prisma.equipment.count({ where: { status: 'EN_SERVICE' } }),
      this.prisma.equipment.count({ where: { status: 'EN_MAINTENANCE' } }),
    ])
    return { total, available, assigned, maintenance }
  }

  // ── Véhicules ──────────────────────────────────────────────────────
  async getVehicles(filters?: { status?: string; type?: string }) {
    return this.prisma.vehicle.findMany({
      where: {
        ...(filters?.status && { status: filters.status as any }),
        ...(filters?.type   && { type: filters.type as any }),
      },
      include: {
        fuelLogs: { orderBy: { date: 'desc' }, take: 5 },
        _count:   { select: { fuelLogs: true } },
      },
      orderBy: { plateNumber: 'asc' },
    })
  }

  async createVehicle(data: { plateNumber: string; type: string; brand: string; model: string; year: number; mileage?: number }) {
    return this.prisma.vehicle.create({ data: { ...data, type: data.type as any, status: 'DISPONIBLE', mileage: data.mileage ?? 0 } })
  }

  async updateVehicle(id: string, data: any) {
    return this.prisma.vehicle.update({ where: { id }, data })
  }

  // ── Carburant ──────────────────────────────────────────────────────
  async addFuelLog(data: {
    vehicleId: string; date: Date; liters: number; pricePerLiter: number; mileage: number; driverId?: string; notes?: string;
  }) {
    const totalCost = data.liters * data.pricePerLiter
    const [log] = await Promise.all([
      this.prisma.fuelLog.create({ data: {
        vehicleId: data.vehicleId,
        liters:    data.liters,
        pricePerL: data.pricePerLiter,
        totalCost,
        mileageAt: data.mileage,
        filledBy:  data.driverId ?? 'inconnu',
        notes:     data.notes,
      }}),
      this.prisma.vehicle.update({ where: { id: data.vehicleId }, data: { mileage: data.mileage } }),
    ])
    return log
  }

  async getFuelLogs(vehicleId?: string) {
    return this.prisma.fuelLog.findMany({
      where: vehicleId ? { vehicleId } : undefined,
      include: {
        vehicle: { select: { plateNumber: true, brand: true, model: true } },
      },
      orderBy: { date: 'desc' },
    })
  }

  async getFuelStats(month?: string) {
    const where: any = {}
    if (month) {
      const d = new Date(month)
      where.date = { gte: new Date(d.getFullYear(), d.getMonth(), 1), lt: new Date(d.getFullYear(), d.getMonth() + 1, 1) }
    }
    const agg = await this.prisma.fuelLog.aggregate({
      _sum: { liters: true, totalCost: true },
      _count: { _all: true },
      where,
    })
    return {
      totalLiters: Number(agg._sum.liters ?? 0),
      totalCost:   Number(agg._sum.totalCost ?? 0),
      nbRefills:   agg._count,
    }
  }
}
