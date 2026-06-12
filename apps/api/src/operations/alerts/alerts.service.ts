import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { randomBytes } from 'crypto'

/**
 * Alertes / SOS terrain — équivalent Odoo sagard.alert.
 * Workflow : NOUVELLE → PRISE_EN_COMPTE → INTERVENTION → RESOLUE (ou FAUSSE)
 * Génère un Incident si déclenchement de "convert".
 */
@Injectable()
export class AlertsService {
  constructor(private prisma: PrismaService) {}

  private nextRef(prefix: string) {
    return `${prefix}-${new Date().getFullYear()}-${randomBytes(3).toString('hex').toUpperCase()}`
  }

  async findAll(filters?: { state?: string; siteId?: string; alertType?: string; severity?: string }) {
    return this.prisma.alert.findMany({
      where: {
        ...(filters?.state     && { state: filters.state as any }),
        ...(filters?.siteId    && { siteId: filters.siteId }),
        ...(filters?.alertType && { alertType: filters.alertType as any }),
        ...(filters?.severity  && { severity: filters.severity as any }),
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
  }

  async findOne(id: string) {
    const a = await this.prisma.alert.findUnique({
      where: { id },
      include: { incident: { select: { id: true, reference: true, state: true } } },
    })
    if (!a) throw new NotFoundException('Alerte introuvable')
    return a
  }

  async create(data: any) {
    return this.prisma.alert.create({
      data: {
        reference: this.nextRef('ALR'),
        siteId: data.siteId ?? null,
        agentId: data.agentId ?? null,
        alertType: (data.alertType ?? 'SOS') as any,
        severity: (data.severity ?? 'WARNING') as any,
        message: data.message ?? null,
        latitude: data.latitude != null ? Number(data.latitude) : null,
        longitude: data.longitude != null ? Number(data.longitude) : null,
        state: 'NOUVELLE',
      },
    })
  }

  async acknowledge(id: string, userId: string) {
    const a = await this.findOne(id)
    const now = new Date()
    const responseMin = Math.round(((now.getTime() - new Date(a.createdAt).getTime()) / 60000) * 100) / 100
    return this.prisma.alert.update({
      where: { id },
      data: { state: 'PRISE_EN_COMPTE', acknowledgedById: userId, acknowledgedAt: now, responseTimeMin: responseMin },
    })
  }

  async intervention(id: string) { return this.prisma.alert.update({ where: { id }, data: { state: 'INTERVENTION' } }) }
  async resolve(id: string)      { return this.prisma.alert.update({ where: { id }, data: { state: 'RESOLUE', resolvedAt: new Date() } }) }
  async markFalse(id: string)    { return this.prisma.alert.update({ where: { id }, data: { state: 'FAUSSE' } }) }

  /** Crée un Incident à partir de l'alerte et le lie */
  async convertToIncident(id: string) {
    const a = await this.findOne(id)
    if (!a.siteId) throw new Error('Une alerte sans site ne peut pas être convertie en incident.')
    const typeMap: Record<string, string> = {
      SOS: 'AGRESSION', INTRUSION: 'INTRUSION', INCENDIE: 'INCENDIE',
      MEDICAL: 'MEDICAL', TECHNIQUE: 'TECHNIQUE',
    }
    const incident = await this.prisma.incident.create({
      data: {
        reference: this.nextRef('INC'),
        title: `${a.reference} — Alerte ${a.alertType}`,
        siteId: a.siteId,
        incidentDatetime: a.createdAt,
        incidentType: (typeMap[a.alertType] ?? 'AUTRE') as any,
        severity: a.severity === 'CRITIQUE' ? 'CRITIQUE' : 'MOYEN',
        state: 'OUVERT',
        reporterId: a.agentId,
        description: a.message ?? `Alerte ${a.alertType} émise par l'agent.`,
      },
    })
    await this.prisma.alert.update({ where: { id }, data: { incidentId: incident.id } })
    return incident
  }
}
