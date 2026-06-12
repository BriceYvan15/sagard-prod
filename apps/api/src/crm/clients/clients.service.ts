import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { WhatsappService } from '../../whatsapp/whatsapp.service'

@Injectable()
export class ClientsService {
  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsappService,
  ) {}

  async findAll(filters?: { status?: string; search?: string; createdById?: string }) {
    const clients = await this.prisma.client.findMany({
      where: {
        ...(filters?.status && { status: filters.status as any }),
        ...(filters?.createdById && { createdById: filters.createdById }),
        ...(filters?.search && {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { legalName: { contains: filters.search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        contracts: { where: { status: 'ACTIF' }, select: { id: true, type: true, monthlyAmount: true } },
        sites:     { where: { status: 'ACTIF' }, select: { id: true, name: true } },
        _count:    { select: { invoices: true, complaints: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Enrich with commercial user info
    const creatorIds = [...new Set(clients.map(c => c.createdById).filter(Boolean))] as string[]
    const creators = creatorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, firstName: true, lastName: true, role: true },
        })
      : []
    const creatorMap = Object.fromEntries(creators.map(u => [u.id, u]))

    return clients.map(c => ({
      ...c,
      createdBy: c.createdById ? creatorMap[c.createdById] ?? null : null,
    }))
  }

  async findOne(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        contracts: { orderBy: { startDate: 'desc' } },
        sites:     { include: { deployments: { where: { isActive: true }, select: { id: true } } } },
        invoices:  { orderBy: { createdAt: 'desc' }, take: 10 },
        complaints:{ orderBy: { createdAt: 'desc' }, take: 5 },
      },
    })
    if (!client) throw new NotFoundException('Client introuvable')
    return client
  }

  private async generateClientCode() {
    const year  = new Date().getFullYear()
    const count = await this.prisma.client.count({
      where: { code: { startsWith: `CLI-${year}-` } },
    })
    return `CLI-${year}-${String(count + 1).padStart(4, '0')}`
  }

  async create(data: {
    // Identification
    name: string; legalName?: string; segment?: string; sector?: string;
    taxId?: string; vat?: string; rccm?: string; ncc?: string;
    cniNumber?: string;
    // Contact principal intégré
    contactFirstName?: string; contactLastName?: string;
    // Coordonnées directes
    phone?: string; phone2?: string; mobile?: string; email?: string; website?: string;
    // Adresse
    address: string; street2?: string; zip?: string; city: string;
    district?: string; quartier?: string; country?: string;
    // GPS
    latitude?: number; longitude?: number;
    notes?: string;
    createdById?: string;
    // Contact principal (legacy + obligatoire pour init WhatsApp)
    contactPhone: string;
    contactEmail?: string; contactWhatsapp?: string; contactPosition?: string;
    // Contacts secondaires
    additionalContacts?: Array<{
      firstName: string; lastName: string; phone: string;
      email?: string; whatsapp?: string; position?: string;
    }>;
  }) {
    const code = await this.generateClientCode()
    const client = await this.prisma.client.create({
      data: {
        code,
        name: data.name, legalName: data.legalName,
        segment: (data.segment as any) ?? 'AUTRE',
        sector: data.sector,
        taxId: data.taxId, vat: data.vat, rccm: data.rccm, ncc: data.ncc,
        contactFirstName: data.contactFirstName, contactLastName: data.contactLastName,
        cniNumber: data.cniNumber,
        phone: data.phone, phone2: data.phone2,
        mobile: data.mobile, email: data.email, website: data.website,
        address: data.address, street2: data.street2, zip: data.zip,
        city: data.city, district: data.district, quartier: data.quartier,
        country: data.country ?? "Côte d'Ivoire",
        latitude: data.latitude, longitude: data.longitude,
        notes: data.notes,
        status: 'PROSPECT',
        createdById: data.createdById || null,
      },
    })

    // Contact principal
    await this.prisma.clientContact.create({
      data: {
        clientId: client.id,
        firstName: data.contactFirstName, lastName: data.contactLastName,
        phone: data.contactPhone, email: data.contactEmail,
        whatsapp: data.contactWhatsapp, position: data.contactPosition,
        isPrimary: true,
      },
    })

    // Contacts secondaires
    if (data.additionalContacts?.length) {
      await this.prisma.clientContact.createMany({
        data: data.additionalContacts.map(c => ({
          clientId: client.id,
          firstName: c.firstName, lastName: c.lastName, phone: c.phone,
          email: c.email, whatsapp: c.whatsapp, position: c.position,
          isPrimary: false,
        })),
      })
    }

    return client
  }

  async remove(id: string) {
    const client = await this.findOne(id)
    // Soft delete: mark as inactive instead of hard delete to preserve history
    return this.prisma.client.update({
      where: { id },
      data: { status: 'INACTIF' as any, notes: `[SUPPRIMÉ] ${client.notes ?? ''}`.trim() },
    })
  }

  async update(id: string, data: Partial<{
    name: string; legalName: string; segment: string; sector: string;
    taxId: string; vat: string; rccm: string; ncc: string; cniNumber: string;
    contactFirstName: string; contactLastName: string;
    phone: string; phone2: string; mobile: string; email: string; website: string;
    address: string; street2: string; zip: string; city: string;
    district: string; quartier: string; country: string;
    latitude: number; longitude: number;
    notes: string; status: string;
  }>) {
    await this.findOne(id)
    return this.prisma.client.update({ where: { id }, data: data as any })
  }

  // ─── Gestion des contacts secondaires ───
  async addContact(clientId: string, data: {
    firstName: string; lastName: string; phone: string;
    email?: string; whatsapp?: string; position?: string;
  }) {
    return this.prisma.clientContact.create({
      data: { clientId, ...data, isPrimary: false },
    })
  }

  async removeContact(contactId: string) {
    return this.prisma.clientContact.delete({ where: { id: contactId } })
  }

  async getStats(id: string) {
    const [invoices, contracts] = await Promise.all([
      this.prisma.invoice.findMany({ where: { clientId: id }, select: { totalAmount: true, status: true, paidAt: true } }),
      this.prisma.clientContract.findMany({ where: { clientId: id }, select: { monthlyAmount: true, status: true } }),
    ])

    const totalFacturé    = invoices.reduce((s, i) => s + Number(i.totalAmount), 0)
    const totalPayé       = invoices.filter(i => i.status === 'PAYEE').reduce((s, i) => s + Number(i.totalAmount), 0)
    const totalImpayé     = invoices.filter(i => i.status === 'RETARD').reduce((s, i) => s + Number(i.totalAmount), 0)
    const revenusActuels  = contracts.filter(c => c.status === 'ACTIF').reduce((s, c) => s + Number(c.monthlyAmount), 0)

    return { totalFacturé, totalPayé, totalImpayé, revenusActuels, nbFactures: invoices.length, nbContrats: contracts.length }
  }

  async createComplaint(clientId: string, data: { title: string; description: string; priority?: string }) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      include: { contacts: { where: { isPrimary: true }, take: 1 } },
    })
    if (!client) throw new NotFoundException('Client introuvable')

    const count = await this.prisma.complaint.count()
    const reference = `REC-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`

    const complaint = await this.prisma.complaint.create({
      data: { reference, clientId, title: data.title, description: data.description, priority: data.priority ?? 'NORMAL', status: 'OUVERTE' },
    })

    const primaryContact = client.contacts[0]
    if (primaryContact?.whatsapp) {
      await this.whatsapp.notifyClientComplaint(primaryContact.whatsapp, reference, client.name)
    }

    return complaint
  }

  async getComplaints(clientId: string) {
    return this.prisma.complaint.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    })
  }
}
