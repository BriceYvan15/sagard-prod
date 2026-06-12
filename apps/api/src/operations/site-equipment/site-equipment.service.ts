import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class SiteEquipmentService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: { siteId?: string; category?: string; state?: string }) {
    const where: any = {}
    if (filters?.siteId) where.siteId = filters.siteId
    if (filters?.category) where.category = filters.category
    if (filters?.state) where.state = filters.state

    return this.prisma.siteEquipment.findMany({
      where,
      include: {
        site: { select: { id: true, name: true } },
        _count: { select: { movements: true } },
      },
      orderBy: { name: 'asc' },
    })
  }

  async findOne(id: string) {
    return this.prisma.siteEquipment.findUniqueOrThrow({
      where: { id },
      include: {
        site: { select: { id: true, name: true } },
        movements: { orderBy: { date: 'desc' }, take: 20 },
      },
    })
  }

  async create(data: any) {
    const count = await this.prisma.siteEquipment.count()
    const code = data.code || `EQ-${String(count + 1).padStart(5, '0')}`

    return this.prisma.siteEquipment.create({
      data: {
        code,
        barcode: data.barcode,
        name: data.name,
        category: data.category ?? 'TENUE',
        siteId: data.siteId,
        employeeId: data.employeeId,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
        purchaseValue: data.purchaseValue,
        currency: data.currency ?? 'XOF',
        supplierId: data.supplierId,
        warrantyEnd: data.warrantyEnd ? new Date(data.warrantyEnd) : null,
        lastCheckDate: data.lastCheckDate ? new Date(data.lastCheckDate) : null,
        nextCheckDate: data.nextCheckDate ? new Date(data.nextCheckDate) : null,
        weaponCaliber: data.weaponCaliber,
        weaponAuthorization: data.weaponAuthorization,
        weaponAuthorizationExp: data.weaponAuthorizationExp ? new Date(data.weaponAuthorizationExp) : null,
        notes: data.notes,
        imageUrl: data.imageUrl,
      },
    })
  }

  async update(id: string, data: any) {
    return this.prisma.siteEquipment.update({ where: { id }, data })
  }

  async assign(id: string, data: any) {
    const eq = await this.prisma.siteEquipment.findUniqueOrThrow({ where: { id } })
    if (eq.state === 'ATTRIBUE') {
      throw new BadRequestException('Matériel déjà attribué')
    }

    await this.prisma.equipmentMovement.create({
      data: {
        equipmentId: id,
        movementType: 'ATTRIBUTION',
        employeeId: data.employeeId,
        siteId: data.siteId,
        condition: data.condition ?? 'BON',
        userId: data.userId,
        notes: data.notes,
      },
    })

    return this.prisma.siteEquipment.update({
      where: { id },
      data: {
        state: 'ATTRIBUE',
        employeeId: data.employeeId,
        siteId: data.siteId ?? eq.siteId,
      },
    })
  }

  async returnEquipment(id: string, data?: any) {
    const eq = await this.prisma.siteEquipment.findUniqueOrThrow({ where: { id } })

    await this.prisma.equipmentMovement.create({
      data: {
        equipmentId: id,
        movementType: 'RETOUR',
        employeeId: eq.employeeId,
        siteId: eq.siteId,
        condition: data?.condition ?? 'BON',
        userId: data?.userId,
        notes: data?.notes,
      },
    })

    return this.prisma.siteEquipment.update({
      where: { id },
      data: { state: 'EN_STOCK', employeeId: null },
    })
  }

  async sendToMaintenance(id: string, data?: any) {
    await this.prisma.equipmentMovement.create({
      data: {
        equipmentId: id,
        movementType: 'MAINTENANCE',
        notes: data?.notes,
        userId: data?.userId,
      },
    })

    return this.prisma.siteEquipment.update({
      where: { id },
      data: { state: 'EN_MAINTENANCE' },
    })
  }

  async declareLost(id: string, data?: any) {
    const eq = await this.prisma.siteEquipment.findUniqueOrThrow({ where: { id } })

    await this.prisma.equipmentMovement.create({
      data: {
        equipmentId: id,
        movementType: 'PERTE',
        employeeId: eq.employeeId,
        notes: data?.notes,
        userId: data?.userId,
      },
    })

    return this.prisma.siteEquipment.update({
      where: { id },
      data: { state: 'PERDU', employeeId: null },
    })
  }

  async getMovements(equipmentId: string) {
    return this.prisma.equipmentMovement.findMany({
      where: { equipmentId },
      orderBy: { date: 'desc' },
    })
  }
}
