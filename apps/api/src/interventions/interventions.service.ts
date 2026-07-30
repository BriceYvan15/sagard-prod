import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { randomBytes } from 'crypto'

@Injectable()
export class InterventionsService {
  constructor(private prisma: PrismaService) {}

  private nextRef(): string {
    return `INT-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`
  }

  /** Liste toutes les interventions (DG/CHEF_OPS) ou seulement celles assignées au technicien */
  async findAll(filters?: { status?: string; technicianId?: string; type?: string }, user?: { id: string; role: string }) {
    const where: any = {}
    if (filters?.status) where.status = filters.status
    if (filters?.type) where.type = filters.type
    if (filters?.technicianId) where.technicianId = filters.technicianId

    // Les techniciens ne voient que leurs interventions
    if (user && user.role === 'TECHNICIEN') {
      where.technicianId = user.id
    }

    return this.prisma.intervention.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, phone: true, email: true, address: true, city: true } },
        site: { select: { id: true, name: true, address: true, city: true, latitude: true, longitude: true } },
        technician: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
      orderBy: { scheduledDate: 'desc' },
    })
  }

  async findOne(id: string) {
    const intervention = await this.prisma.intervention.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, phone: true, email: true, address: true, city: true } },
        site: { select: { id: true, name: true, address: true, city: true, latitude: true, longitude: true } },
        technician: { select: { id: true, firstName: true, lastName: true, phone: true } },
      },
    })
    if (!intervention) throw new NotFoundException('Intervention introuvable')
    return intervention
  }

  async create(data: {
    type: string
    title: string
    description?: string
    clientId?: string
    siteId?: string
    technicianId?: string
    scheduledDate: string
    priority?: string
    equipmentList?: string
    notes?: string
  }, userId?: string) {
    return this.prisma.intervention.create({
      data: {
        reference: this.nextRef(),
        type: data.type as any,
        title: data.title,
        description: data.description ?? null,
        clientId: data.clientId ?? null,
        siteId: data.siteId ?? null,
        technicianId: data.technicianId ?? null,
        scheduledDate: new Date(data.scheduledDate),
        priority: data.priority ?? 'NORMALE',
        equipmentList: data.equipmentList ?? null,
        notes: data.notes ?? null,
        status: data.technicianId ? 'ASSIGNEE' : 'PLANIFIEE',
        createdById: userId ?? null,
      },
      include: {
        client: { select: { id: true, name: true } },
        site: { select: { id: true, name: true } },
        technician: { select: { id: true, firstName: true, lastName: true } },
      },
    })
  }

  /** Assigner un technicien à une intervention */
  async assignTechnician(id: string, technicianId: string) {
    const tech = await this.prisma.user.findFirst({ where: { id: technicianId, role: 'TECHNICIEN', status: 'ACTIF' } })
    if (!tech) throw new BadRequestException('Technicien introuvable ou inactif')

    return this.prisma.intervention.update({
      where: { id },
      data: { technicianId, status: 'ASSIGNEE' },
    })
  }

  /** Le technicien démarre l'intervention */
  async startIntervention(id: string, userId: string) {
    const intervention = await this.findOne(id)
    if (intervention.technicianId !== userId) throw new BadRequestException('Cette intervention ne vous est pas assignée')
    if (intervention.status !== 'ASSIGNEE') throw new BadRequestException('L\'intervention doit être assignée pour démarrer')

    return this.prisma.intervention.update({
      where: { id },
      data: { status: 'EN_COURS' },
    })
  }

  /** Le technicien termine l'intervention avec rapport et photos */
  async completeIntervention(id: string, userId: string, data: { report?: string; afterPhotos?: string[] }) {
    const intervention = await this.findOne(id)
    if (intervention.technicianId !== userId) throw new BadRequestException('Cette intervention ne vous est pas assignée')
    if (intervention.status !== 'EN_COURS') throw new BadRequestException('L\'intervention doit être en cours pour être terminée')

    return this.prisma.intervention.update({
      where: { id },
      data: {
        status: 'TERMINEE',
        completedAt: new Date(),
        report: data.report ?? null,
        afterPhotos: data.afterPhotos ?? [],
      },
    })
  }

  /** Reporter une intervention */
  async reschedule(id: string, newDate: string) {
    await this.findOne(id)
    return this.prisma.intervention.update({
      where: { id },
      data: { scheduledDate: new Date(newDate), status: 'REPORTER' },
    })
  }

  /** Annuler une intervention */
  async cancel(id: string) {
    await this.findOne(id)
    return this.prisma.intervention.update({
      where: { id },
      data: { status: 'ANNULEE' },
    })
  }

  /** Ajouter photos avant intervention */
  async addBeforePhotos(id: string, photos: string[]) {
    await this.findOne(id)
    const current = await this.prisma.intervention.findUnique({ where: { id }, select: { beforePhotos: true } })
    return this.prisma.intervention.update({
      where: { id },
      data: { beforePhotos: [...(current?.beforePhotos ?? []), ...photos] },
    })
  }
}
