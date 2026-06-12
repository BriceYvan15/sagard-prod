import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { randomBytes } from 'crypto'

/**
 * Service AgentDeployment — équivalent Odoo sagard.deployment.
 * Workflow : BROUILLON → ACTIF → (REMPLACE | TERMINE)
 */
@Injectable()
export class DeploymentsService {
  constructor(private prisma: PrismaService) {}

  private nextRef(): string {
    return `DEP-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`
  }

  async findAll(filters?: { siteId?: string; agentId?: string; state?: string; contractId?: string }) {
    return this.prisma.agentDeployment.findMany({
      where: {
        ...(filters?.siteId    && { siteId: filters.siteId }),
        ...(filters?.agentId   && { agentId: filters.agentId }),
        ...(filters?.state     && { state: filters.state as any }),
        ...(filters?.contractId && { contractId: filters.contractId }),
      },
      include: {
        agent: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
        site:  { select: { id: true, name: true, code: true, city: true } },
        contract: { select: { id: true, reference: true } },
        replacedBy: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { startDate: 'desc' },
    })
  }

  async findOne(id: string) {
    const d = await this.prisma.agentDeployment.findUnique({
      where: { id },
      include: {
        agent: { include: { user: true } },
        site: true,
        contract: true,
        replacedBy: { include: { user: true } },
        pointages: { take: 30, orderBy: { date: 'desc' } },
      },
    })
    if (!d) throw new NotFoundException('Affectation introuvable')
    return d
  }

  /** Empêche un agent d'être affecté à 2 sites actifs en même temps sur la même période */
  private async checkOverlap(agentId: string, start: Date, end: Date | null, excludeId?: string) {
    const overlap = await this.prisma.agentDeployment.findFirst({
      where: {
        agentId,
        state: 'ACTIF',
        ...(excludeId && { NOT: { id: excludeId } }),
        startDate: { lte: end ?? new Date('9999-12-31') },
        OR: [{ endDate: null }, { endDate: { gte: start } }],
      },
      select: { id: true, reference: true, site: { select: { name: true } } },
    })
    if (overlap) {
      throw new BadRequestException(
        `Cet agent est déjà affecté (${overlap.reference} — ${overlap.site.name}) sur la période demandée.`
      )
    }
  }

  async create(data: any) {
    const start = data.startDate ? new Date(data.startDate) : new Date()
    const end   = data.endDate   ? new Date(data.endDate)   : null
    if (data.state === 'ACTIF') await this.checkOverlap(data.agentId, start, end)
    return this.prisma.agentDeployment.create({
      data: {
        reference:   data.reference ?? this.nextRef(),
        agentId:     data.agentId,
        siteId:      data.siteId,
        contractId:  data.contractId ?? null,
        shift:       (data.shift ?? 'JOUR') as any,
        shiftKind:   (data.shiftKind ?? data.shift ?? 'JOUR') as any,
        role:        (data.role ?? 'AGENT') as any,
        state:       (data.state ?? 'BROUILLON') as any,
        startDate:   start,
        endDate:     end,
        isActive:    data.state === 'ACTIF',
        assignedBy:  data.assignedBy ?? null,
        notes:       data.notes ?? null,
      },
    })
  }

  async update(id: string, data: any) {
    await this.findOne(id)
    const patch: any = { ...data }
    if (patch.startDate) patch.startDate = new Date(patch.startDate)
    if (patch.endDate)   patch.endDate   = new Date(patch.endDate)
    return this.prisma.agentDeployment.update({ where: { id }, data: patch })
  }

  // ─── Transitions workflow ────────────────────────────────────────
  async activate(id: string) {
    const d = await this.findOne(id)
    if (d.state === 'ACTIF') return d
    await this.checkOverlap(d.agentId, d.startDate, d.endDate, id)
    return this.prisma.agentDeployment.update({
      where: { id },
      data: { state: 'ACTIF', isActive: true },
    })
  }

  async end(id: string) {
    return this.prisma.agentDeployment.update({
      where: { id },
      data: { state: 'TERMINE', isActive: false, endDate: new Date() },
    })
  }

  /** Remplace l'agent par un autre : termine l'actuel + crée un nouveau déploiement actif */
  async replace(id: string, body: { replacementAgentId: string; startDate?: string }) {
    const current = await this.findOne(id)
    if (current.state !== 'ACTIF') {
      throw new BadRequestException('Seule une affectation ACTIVE peut être remplacée.')
    }
    const start = body.startDate ? new Date(body.startDate) : new Date()
    return this.prisma.$transaction(async tx => {
      await tx.agentDeployment.update({
        where: { id },
        data: { state: 'REMPLACE', isActive: false, endDate: start, replacedById: body.replacementAgentId },
      })
      return tx.agentDeployment.create({
        data: {
          reference:  this.nextRef(),
          agentId:    body.replacementAgentId,
          siteId:     current.siteId,
          contractId: current.contractId,
          shift:      current.shift,
          shiftKind:  current.shiftKind,
          role:       current.role,
          state:      'ACTIF',
          startDate:  start,
          isActive:   true,
          assignedBy: 'replace',
          notes:      `Remplace l'affectation ${current.reference}`,
        },
      })
    })
  }
}
