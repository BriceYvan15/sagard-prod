import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { Role } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: { role?: Role; status?: string }) {
    return this.prisma.user.findMany({
      where: {
        ...(filters?.role && { role: filters.role }),
        ...(filters?.status && { status: filters.status as any }),
      },
      select: {
        id: true, email: true, phone: true, role: true, status: true,
        firstName: true, lastName: true, photoUrl: true, lastLoginAt: true, createdAt: true,
        agent: { select: { id: true, matricule: true, position: true, status: true } },
      },
      orderBy: { firstName: 'asc' },
    })
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, phone: true, role: true, status: true,
        firstName: true, lastName: true, photoUrl: true, whatsappPhone: true,
        lastLoginAt: true, createdAt: true,
        agent: true,
        notifications: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    })
    if (!user) throw new NotFoundException('Utilisateur introuvable')
    return user
  }

  async create(data: {
    email: string; phone: string; password: string; role: Role;
    firstName: string; lastName: string; whatsappPhone?: string;
  }) {
    const exists = await this.prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { phone: data.phone }] },
    })
    if (exists) throw new ConflictException('Email ou téléphone déjà utilisé')

    const passwordHash = await bcrypt.hash(data.password, 12)
    return this.prisma.user.create({
      data: {
        email: data.email, phone: data.phone, passwordHash,
        role: data.role, firstName: data.firstName, lastName: data.lastName,
        whatsappPhone: data.whatsappPhone,
      },
      select: {
        id: true, email: true, phone: true, role: true, status: true,
        firstName: true, lastName: true, createdAt: true,
      },
    })
  }

  async update(id: string, data: {
    email?: string; phone?: string; password?: string; role?: Role;
    firstName?: string; lastName?: string; whatsappPhone?: string;
  }) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('Utilisateur introuvable')

    if (data.email && data.email !== user.email) {
      const exists = await this.prisma.user.findFirst({ where: { email: data.email, NOT: { id } } })
      if (exists) throw new ConflictException('Email déjà utilisé')
    }
    if (data.phone && data.phone !== user.phone) {
      const exists = await this.prisma.user.findFirst({ where: { phone: data.phone, NOT: { id } } })
      if (exists) throw new ConflictException('Téléphone déjà utilisé')
    }

    const updateData: any = {}
    if (data.email) updateData.email = data.email
    if (data.phone) updateData.phone = data.phone
    if (data.role) updateData.role = data.role
    if (data.firstName) updateData.firstName = data.firstName
    if (data.lastName) updateData.lastName = data.lastName
    if (data.whatsappPhone !== undefined) updateData.whatsappPhone = data.whatsappPhone
    if (data.password) updateData.passwordHash = await bcrypt.hash(data.password, 12)

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true, email: true, phone: true, role: true, status: true,
        firstName: true, lastName: true, photoUrl: true, whatsappPhone: true,
        lastLoginAt: true, createdAt: true,
        agent: { select: { id: true, matricule: true, position: true, status: true } },
      },
    })
  }

  async updatePhoto(id: string, photoUrl: string) {
    return this.prisma.user.update({ where: { id }, data: { photoUrl } })
  }

  async suspend(id: string) {
    return this.prisma.user.update({ where: { id }, data: { status: 'SUSPENDU' } })
  }

  async activate(id: string) {
    return this.prisma.user.update({ where: { id }, data: { status: 'ACTIF' } })
  }
}
