import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

// Mapping: entity → service/department that "owns" it
const ENTITY_SERVICE: Record<string, string> = {
  Client:           'CRM',
  ClientContract:   'CRM',
  Invoice:          'COMPTABILITE',
  Lead:             'CRM',
  BillingRun:       'COMPTABILITE',
  Agent:            'OPERATIONS',
  Site:             'OPERATIONS',
  AgentDeployment:  'OPERATIONS',
  Pointage:         'OPERATIONS',
  Incident:         'OPERATIONS',
  DailyReport:      'OPERATIONS',
  Equipment:        'STOCK',
  Vehicle:          'STOCK',
  FuelLog:          'STOCK',
  Maintenance:      'STOCK',
  Payroll:          'RH',
  PayrollLine:      'RH',
  Leave:            'RH',
  Training:         'RH',
  DisciplinaryRecord: 'RH',
  Candidacy:        'RH',
  User:             'ADMIN',
}

// Which roles belong to which service
const ROLE_SERVICE: Record<string, string[]> = {
  DIRECTEUR_GENERAL: ['*'],
  COMMERCIAL:        ['CRM'],
  COMPTABLE:         ['COMPTABILITE', 'CRM'],
  RH:                ['RH'],
  CHEF_OPERATIONS:   ['OPERATIONS'],
  CONTROLEUR:        ['OPERATIONS'],
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    userId?: string
    action: 'CREATE' | 'UPDATE' | 'DELETE'
    entity: string
    entityId?: string
    oldData?: any
    newData?: any
    ipAddress?: string
    userAgent?: string
  }) {
    return this.prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        oldData: params.oldData ?? undefined,
        newData: params.newData ?? undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    })
  }

  async getHistory(params: {
    entity?: string
    entityId?: string
    userId?: string
    userRole?: string
    page?: number
    limit?: number
  }) {
    const { entity, entityId, userId, userRole, page = 1, limit = 50 } = params

    // Determine which services the requesting user's role can see
    let allowedServices: string[] | null = null
    if (userRole && userRole !== 'DIRECTEUR_GENERAL') {
      allowedServices = ROLE_SERVICE[userRole] ?? []
    }

    // Build entity filter based on allowed services
    let entityFilter: string[] | undefined
    if (allowedServices && !allowedServices.includes('*')) {
      entityFilter = Object.entries(ENTITY_SERVICE)
        .filter(([_, svc]) => allowedServices!.includes(svc))
        .map(([ent]) => ent)
    }

    const where: any = {}
    if (entity) where.entity = entity
    if (entityId) where.entityId = entityId
    if (userId) where.userId = userId
    if (entityFilter) where.entity = { in: entityFilter }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ])

    return {
      logs: logs.map(l => ({
        ...l,
        service: ENTITY_SERVICE[l.entity] ?? 'AUTRE',
      })),
      total,
      page,
      pages: Math.ceil(total / limit),
    }
  }

  async getEntityHistory(entity: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entity, entityId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }
}
