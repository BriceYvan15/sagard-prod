import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class TransfersService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: { agentId?: string; fromSiteId?: string; toSiteId?: string }) {
    return this.prisma.agentTransfer.findMany({
      where: {
        ...(filters?.agentId && { agentId: filters.agentId }),
        ...(filters?.fromSiteId && { fromSiteId: filters.fromSiteId }),
        ...(filters?.toSiteId && { toSiteId: filters.toSiteId }),
      },
      include: {
        agent: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
        fromSite: { select: { id: true, name: true, code: true, city: true } },
        toSite: { select: { id: true, name: true, code: true, city: true } },
        decidedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { transferDate: 'desc' },
      take: 200,
    })
  }

  async findByAgent(agentId: string) {
    return this.prisma.agentTransfer.findMany({
      where: { agentId },
      include: {
        fromSite: { select: { id: true, name: true, code: true, city: true } },
        toSite: { select: { id: true, name: true, code: true, city: true } },
        decidedBy: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { transferDate: 'desc' },
    })
  }
}
