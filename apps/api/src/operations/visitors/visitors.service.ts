import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class VisitorsService {
  constructor(private prisma: PrismaService) {}

  async findAll(siteId?: string) {
    return this.prisma.visitorLog.findMany({
      where: siteId ? { siteId } : undefined,
      include: {
        site: { select: { id: true, name: true } },
        agent: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { checkIn: 'desc' },
      take: 200,
    })
  }

  async findOne(id: string) {
    return this.prisma.visitorLog.findUniqueOrThrow({
      where: { id },
      include: {
        site: { select: { id: true, name: true } },
        agent: { select: { id: true, firstName: true, lastName: true } },
        keyMovements: { include: { key: true } },
      },
    })
  }

  async create(data: any) {
    const count = await this.prisma.visitorLog.count()
    const reference = `VIS-${String(count + 1).padStart(5, '0')}`

    // Check blacklist
    let isBlacklisted = false
    if (data.idNumber) {
      const bl = await this.prisma.blacklist.findFirst({
        where: { idNumber: data.idNumber, active: true },
      })
      isBlacklisted = !!bl
    }

    return this.prisma.visitorLog.create({
      data: {
        reference,
        siteId: data.siteId,
        visitorName: data.visitorName,
        visitorCompany: data.visitorCompany,
        visitorPhone: data.visitorPhone,
        idType: data.idType ?? 'CNI',
        idNumber: data.idNumber,
        visitPurpose: data.visitPurpose ?? 'REUNION',
        hostName: data.hostName,
        plateNumber: data.plateNumber,
        badgeNo: data.badgeNo,
        agentId: data.agentId,
        photoUrl: data.photoUrl,
        notes: data.notes,
        isBlacklisted,
      },
      include: {
        site: { select: { id: true, name: true } },
        agent: { select: { id: true, firstName: true, lastName: true } },
      },
    })
  }

  async checkOut(id: string) {
    const visitor = await this.prisma.visitorLog.findUniqueOrThrow({ where: { id } })
    const now = new Date()
    const durationMin = visitor.checkIn
      ? (now.getTime() - new Date(visitor.checkIn).getTime()) / 60000
      : null

    return this.prisma.visitorLog.update({
      where: { id },
      data: {
        checkOut: now,
        durationMin: durationMin ? Math.round(durationMin * 10) / 10 : null,
        badgeReturned: true,
      },
    })
  }

  async update(id: string, data: any) {
    return this.prisma.visitorLog.update({ where: { id }, data })
  }

  // ── Blacklist ──
  async getBlacklist(siteId?: string) {
    return this.prisma.blacklist.findMany({
      where: { active: true },
      include: { sites: { include: { site: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async addToBlacklist(data: any) {
    const bl = await this.prisma.blacklist.create({
      data: {
        name: data.name,
        idNumber: data.idNumber,
        reason: data.reason,
        description: data.description,
        photoUrl: data.photoUrl,
        incidentId: data.incidentId,
        dateStart: data.dateStart ? new Date(data.dateStart) : new Date(),
        dateEnd: data.dateEnd ? new Date(data.dateEnd) : null,
      },
    })
    if (data.siteIds?.length) {
      await this.prisma.blacklistSite.createMany({
        data: data.siteIds.map((siteId: string) => ({ blacklistId: bl.id, siteId })),
      })
    }
    return bl
  }

  async removeFromBlacklist(id: string) {
    return this.prisma.blacklist.update({ where: { id }, data: { active: false } })
  }
}
