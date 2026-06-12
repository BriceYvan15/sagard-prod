import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { WhatsappService } from '../../whatsapp/whatsapp.service'
import * as bcrypt from 'bcryptjs'

@Injectable()
export class AgentsService {
  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsappService,
  ) {}

  async findAll(filters?: { status?: string; shift?: string; search?: string }) {
    return this.prisma.agent.findMany({
      where: {
        ...(filters?.status && { status: filters.status as any }),
        ...(filters?.shift  && { shift: filters.shift as any }),
        ...(filters?.search && {
          user: {
            OR: [
              { firstName: { contains: filters.search, mode: 'insensitive' } },
              { lastName:  { contains: filters.search, mode: 'insensitive' } },
              { phone:     { contains: filters.search } },
            ],
          },
        }),
      },
      include: {
        user:  { select: { id: true, firstName: true, lastName: true, phone: true, email: true, photoUrl: true, status: true } },
        deployments: { where: { isActive: true }, select: { id: true, site: { select: { id: true, name: true, district: true } } } },
        equipments: { where: { returnedAt: null }, select: { id: true, equipment: { select: { name: true, code: true } } } },
      },
      orderBy: { matricule: 'asc' },
    })
  }

  async findOne(id: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
      include: {
        user: true,
        deployments: { where: { isActive: true }, include: { site: { select: { name: true, district: true } } } },
        pointages:  { orderBy: { checkInTime: 'desc' }, take: 30 },
        payrolls:   { orderBy: { payrollId: 'desc' }, take: 12 },
        leaves:     { orderBy: { startDate: 'desc' }, take: 5 },
        trainings:  { orderBy: { startDate: 'desc' }, take: 5 },
        equipments: { include: { equipment: true }, orderBy: { assignedAt: 'desc' }, take: 10 },
      },
    })
    if (!agent) throw new NotFoundException('Agent introuvable')
    return agent
  }

  async create(data: {
    userId: string; position: string; shift: string; hireDate: Date; baseSalary: number;
    contractType?: string; cniNumber?: string; department?: string; educationLevel?: string;
    emergencyContact?: string; emergencyPhone?: string; emergencyRelation?: string; address?: string;
  }) {
    const count = await this.prisma.agent.count()
    const matricule = `AGT-${String(count + 1).padStart(4, '0')}`
    return this.prisma.agent.create({
      data: {
        userId: data.userId,
        matricule,
        position: data.position,
        shift: data.shift as any,
        status: 'EN_POSTE',
        hireDate: data.hireDate,
        baseSalary: data.baseSalary,
        cniNumber: data.cniNumber,
        department: data.department,
        educationLevel: data.educationLevel as any,
        contractType: data.contractType as any,
        emergencyContact: data.emergencyContact,
        emergencyPhone: data.emergencyPhone,
        emergencyRelation: data.emergencyRelation,
        address: data.address,
      },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    })
  }

  async createWithUser(data: {
    firstName: string; lastName: string; phone: string; email: string; password: string;
    role?: string; position: string; shift: string; hireDate: Date; baseSalary: number;
    contractType?: string; cniNumber?: string; department?: string; educationLevel?: string;
    emergencyContact?: string; emergencyPhone?: string; emergencyRelation?: string; address?: string;
    contractEndDate?: Date;
  }) {
    if (!data.email || !data.phone || !data.firstName || !data.lastName) {
      throw new BadRequestException('Nom, prénom, email et téléphone sont obligatoires')
    }
    if (!data.password || data.password.length < 6) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 6 caractères')
    }

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { phone: data.phone }] },
    })
    if (existing) {
      throw new BadRequestException(
        existing.email === data.email ? 'Cet email est déjà utilisé' : 'Ce numéro de téléphone est déjà utilisé'
      )
    }

    const passwordHash = await bcrypt.hash(data.password, 12)
    const count = await this.prisma.agent.count()
    const matricule = `AGT-${String(count + 1).padStart(4, '0')}`

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          phone: data.phone,
          passwordHash,
          role: (data.role ?? 'AGENT_TERRAIN') as any,
          firstName: data.firstName,
          lastName: data.lastName,
          status: 'ACTIF',
        },
      })

      const agent = await tx.agent.create({
        data: {
          userId: user.id,
          matricule,
          position: data.position,
          shift: data.shift as any,
          status: 'EN_POSTE',
          hireDate: data.hireDate,
          baseSalary: data.baseSalary,
          cniNumber: data.cniNumber,
          department: data.department,
          educationLevel: data.educationLevel as any,
          contractType: data.contractType as any,
          contractEndDate: data.contractEndDate,
          emergencyContact: data.emergencyContact,
          emergencyPhone: data.emergencyPhone,
          emergencyRelation: data.emergencyRelation,
          address: data.address,
        },
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      })

      return agent
    })
  }

  async update(id: string, data: any) {
    await this.findOne(id)

    // Only allow known Agent fields to prevent Prisma errors
    const str = (v: any) => v != null && v !== '' ? String(v) : undefined
    const enumOrNull = (v: any) => v != null && v !== '' ? String(v) : null   // nullable enums → set null
    const enumReq = (v: any) => v != null && v !== '' ? String(v) : undefined // required enums → skip if empty
    const allowed: Record<string, (v: any) => any> = {
      position: str,
      shift: enumReq,
      department: str,
      status: enumReq,
      contractType: enumOrNull,
      cniNumber: str,
      address: str,
      emergencyContact: str,
      emergencyPhone: str,
      emergencyRelation: str,
      educationLevel: enumOrNull,
      bankAccount: str,
      behaviorRating: enumOrNull,
      baseSalary: (v: any) => v != null && v !== '' ? Number(v) : undefined,
      contractEndDate: (v: any) => v ? new Date(v) : null,
      hireDate: (v: any) => v ? new Date(v) : undefined,
    }

    const sanitized: Record<string, any> = {}
    for (const [key, transform] of Object.entries(allowed)) {
      if (key in data && data[key] !== undefined) {
        const val = transform(data[key])
        if (val !== undefined) sanitized[key] = val
      }
    }

    return this.prisma.agent.update({ where: { id }, data: sanitized })
  }

  async deactivate(id: string) {
    await this.findOne(id)
    return this.prisma.agent.update({
      where: { id },
      data: { status: 'INACTIF' as any },
    })
  }

  async assignEquipment(agentId: string, equipmentId: string, notes?: string) {
    const agent     = await this.findOne(agentId)
    const equipment = await this.prisma.equipment.findUnique({ where: { id: equipmentId } })
    if (!equipment) throw new NotFoundException('Équipement introuvable')

    const assignment = await this.prisma.equipmentAssignment.create({
      data: { agentId, equipmentId, assignedBy: 'system', notes },
    })

    await this.prisma.equipment.update({ where: { id: equipmentId }, data: { status: 'EN_SERVICE' as any } })

    const agentFull = await this.prisma.agent.findUnique({ where: { id: agentId }, include: { user: true } })
    const userPhone = agentFull?.user?.whatsappPhone
    if (userPhone) {
      await this.whatsapp.notifyEquipmentAssignment(userPhone, `${agentFull!.user.firstName} ${agentFull!.user.lastName}`, equipment.name, 'Chef Opérations')
    }

    return assignment
  }

  async returnEquipment(assignmentId: string) {
    const assignment = await this.prisma.equipmentAssignment.update({
      where: { id: assignmentId },
      data: { returnedAt: new Date() },
      include: { equipment: true },
    })
    await this.prisma.equipment.update({ where: { id: assignment.equipmentId }, data: { status: 'DISPONIBLE' as any } })
    return assignment
  }

  async getTodayAbsences() {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const allActive = await this.prisma.agent.findMany({
      where: { status: 'EN_POSTE' },
      select: { id: true, matricule: true, user: { select: { firstName: true, lastName: true } } },
    })
    const checkedIn = await this.prisma.pointage.findMany({
      where: { checkInTime: { gte: today } },
      select: { agentId: true },
    })
    const checkedIds = new Set(checkedIn.map(p => p.agentId))
    return allActive.filter(a => !checkedIds.has(a.id))
  }
}
