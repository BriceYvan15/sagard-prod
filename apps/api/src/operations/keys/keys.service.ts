import { Injectable, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class KeysService {
  constructor(private prisma: PrismaService) {}

  async findAll(siteId?: string) {
    return this.prisma.key.findMany({
      where: siteId ? { siteId } : undefined,
      include: {
        site: { select: { id: true, name: true } },
        _count: { select: { movements: true } },
      },
      orderBy: [{ siteId: 'asc' }, { code: 'asc' }],
    })
  }

  async findOne(id: string) {
    return this.prisma.key.findUniqueOrThrow({
      where: { id },
      include: {
        site: { select: { id: true, name: true } },
        movements: { orderBy: { date: 'desc' }, take: 20 },
      },
    })
  }

  async create(data: any) {
    return this.prisma.key.create({
      data: {
        name: data.name,
        code: data.code,
        siteId: data.siteId,
        keyType: data.keyType ?? 'PORTE',
        notes: data.notes,
      },
    })
  }

  async update(id: string, data: any) {
    return this.prisma.key.update({ where: { id }, data })
  }

  async issueKey(id: string, data: any) {
    const key = await this.prisma.key.findUniqueOrThrow({ where: { id } })
    if (key.state !== 'DISPONIBLE') {
      throw new BadRequestException('Clé non disponible')
    }

    await this.prisma.keyMovement.create({
      data: {
        keyId: id,
        movementType: 'SORTIE',
        employeeId: data.employeeId,
        visitorLogId: data.visitorLogId,
        issuedById: data.issuedById,
        notes: data.notes,
      },
    })

    return this.prisma.key.update({
      where: { id },
      data: { state: 'SORTIE', currentHolderId: data.employeeId },
    })
  }

  async returnKey(id: string, data?: any) {
    const key = await this.prisma.key.findUniqueOrThrow({ where: { id } })
    if (key.state !== 'SORTIE') {
      throw new BadRequestException('Clé non sortie')
    }

    await this.prisma.keyMovement.create({
      data: {
        keyId: id,
        movementType: 'RETOUR',
        employeeId: key.currentHolderId,
        issuedById: data?.issuedById,
        notes: data?.notes,
      },
    })

    return this.prisma.key.update({
      where: { id },
      data: { state: 'DISPONIBLE', currentHolderId: null },
    })
  }

  async declareLost(id: string, data?: any) {
    await this.prisma.keyMovement.create({
      data: {
        keyId: id,
        movementType: 'PERTE',
        employeeId: data?.employeeId,
        notes: data?.notes,
      },
    })

    return this.prisma.key.update({
      where: { id },
      data: { state: 'PERDUE', currentHolderId: null },
    })
  }

  async getMovements(keyId: string) {
    return this.prisma.keyMovement.findMany({
      where: { keyId },
      orderBy: { date: 'desc' },
    })
  }
}
