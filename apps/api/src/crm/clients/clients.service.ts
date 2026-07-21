import { Injectable, NotFoundException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { WhatsappService } from '../../whatsapp/whatsapp.service'
import * as puppeteer from 'puppeteer'
import { LOGO_BASE64 } from '../../mail/logo.constant'

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
        contacts:  { select: { id: true, firstName: true, lastName: true, phone: true, email: true, position: true, isPrimary: true }, orderBy: { isPrimary: 'desc' } },
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
        contacts:  { orderBy: { isPrimary: 'desc' } },
        contracts: { orderBy: { startDate: 'desc' } },
        sites:     { include: { deployments: { where: { isActive: true }, select: { id: true } } } },
        invoices:  { orderBy: { createdAt: 'desc' }, take: 10, include: { lines: true } },
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
    // These come from the frontend but are NOT Client model fields:
    contactPhone: string; contactEmail: string; contactWhatsapp: string; contactPosition: string;
    additionalContacts: any[];
  }>) {
    await this.findOne(id)

    // Separate contact-specific fields from Client model fields
    const {
      contactPhone, contactEmail, contactWhatsapp, contactPosition,
      additionalContacts,
      ...clientData
    } = data

    // Update the Client record with only valid fields
    const updated = await this.prisma.client.update({ where: { id }, data: clientData as any })

    // If contact info was provided, update the primary ClientContact
    if (contactPhone || contactEmail || contactWhatsapp || contactPosition) {
      const primaryContact = await this.prisma.clientContact.findFirst({
        where: { clientId: id, isPrimary: true },
      })
      if (primaryContact) {
        await this.prisma.clientContact.update({
          where: { id: primaryContact.id },
          data: {
            ...(contactPhone     !== undefined && { phone: contactPhone }),
            ...(contactEmail     !== undefined && { email: contactEmail }),
            ...(contactWhatsapp  !== undefined && { whatsapp: contactWhatsapp }),
            ...(contactPosition  !== undefined && { position: contactPosition }),
            ...(data.contactFirstName !== undefined && { firstName: data.contactFirstName }),
            ...(data.contactLastName  !== undefined && { lastName: data.contactLastName }),
          },
        })
      }
    }

    return updated
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

  async generateClientPdf(id: string): Promise<Buffer> {
    const client = await this.findOne(id)
    const stats = await this.getStats(id)
    const c = client as any

    const fmtMoney = (n: number) => new Intl.NumberFormat('fr-FR').format(Number(n ?? 0))
    const fmtDate = (d: any) => d ? new Date(d).toLocaleDateString('fr-FR') : '—'

    const statusLabels: Record<string, string> = {
      ACTIF: 'Actif', INACTIF: 'Inactif', PROSPECT: 'Prospect', SUSPENDU: 'Suspendu',
    }
    const statusColors: Record<string, string> = {
      ACTIF: '#16a34a', INACTIF: '#64748b', PROSPECT: '#2563eb', SUSPENDU: '#dc2626',
    }
    const stColor = statusColors[c.status] ?? '#64748b'
    const stLabel = statusLabels[c.status] ?? c.status

    const segmentLabels: Record<string, string> = {
      COMMERCIAL: 'Commercial', INDUSTRIEL: 'Industriel', RESIDENTIEL: 'Résidentiel',
      INSTITUTIONNEL: 'Institutionnel', ONG: 'ONG', AMBASSADE: 'Ambassade', AUTRE: 'Autre',
    }

    const contacts = (c.contacts ?? []) as any[]
    const contracts = (c.contracts ?? []) as any[]
    const invoices = (c.invoices ?? []) as any[]
    const sites = (c.sites ?? []) as any[]
    const complaints = (c.complaints ?? []) as any[]

    // Build contacts rows
    const contactRows = contacts.length ? contacts.map(ct => `
      <tr>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; font-weight: 600;">
          ${ct.firstName ?? ''} ${ct.lastName ?? ''}
          ${ct.isPrimary ? '<span style="font-size: 9px; background: rgba(200,160,0,0.15); color: #C8A000; padding: 1px 6px; border-radius: 8px; margin-left: 6px;">Principal</span>' : ''}
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #475569;">${ct.position ?? '—'}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #475569;">${ct.phone ?? '—'}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #475569;">${ct.email ?? '—'}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #475569;">${ct.whatsapp ?? '—'}</td>
      </tr>
    `).join('') : '<tr><td colspan="5" style="padding: 12px; text-align: center; color: #94a3b8; font-size: 11px;">Aucun contact enregistré</td></tr>'

    // Build contracts rows
    const contractRows = contracts.length ? contracts.map(ct => `
      <tr>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; font-weight: 600;">${ct.reference ?? ct.title ?? ct.id}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #475569;">${ct.type ?? ct.contractType ?? '—'}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #475569;">${fmtDate(ct.startDate)}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; font-weight: 600; text-align: right;">${fmtMoney(ct.monthlyAmount)} F CFA</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <span style="padding: 2px 8px; border-radius: 8px; font-weight: 600; ${ct.status === 'ACTIF' ? 'background: #f0fdf4; color: #16a34a;' : 'background: #f1f5f9; color: #64748b;'}">${ct.status}</span>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="5" style="padding: 12px; text-align: center; color: #94a3b8; font-size: 11px;">Aucun contrat</td></tr>'

    // Build invoices rows
    const invoiceStatusLabels: Record<string, string> = {
      BROUILLON: 'Brouillon', ENVOYEE: 'Envoyée', ACCEPTEE: 'Acceptée',
      PAYEE: 'Payée', RETARD: 'En retard', ANNULEE: 'Annulée',
    }
    const invoiceRows = invoices.length ? invoices.map(inv => `
      <tr>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; font-weight: 600;">${inv.reference ?? '—'}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #475569;">${fmtDate(inv.issueDate)}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <span style="padding: 2px 8px; border-radius: 8px; font-weight: 600; ${inv.status === 'PAYEE' ? 'background: #f0fdf4; color: #16a34a;' : inv.status === 'RETARD' ? 'background: #fef2f2; color: #dc2626;' : 'background: #f1f5f9; color: #64748b;'}">${invoiceStatusLabels[inv.status] ?? inv.status}</span>
        </td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; font-weight: 600; text-align: right;">${fmtMoney(inv.totalAmount)} F CFA</td>
      </tr>
    `).join('') : '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #94a3b8; font-size: 11px;">Aucune facture</td></tr>'

    // Build sites rows
    const siteRows = sites.length ? sites.map(s => `
      <tr>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; font-weight: 600;">${s.name}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #475569;">${s.address ?? '—'}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #475569;">${s.city ?? '—'}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <span style="padding: 2px 8px; border-radius: 8px; font-weight: 600; ${s.status === 'ACTIF' ? 'background: #f0fdf4; color: #16a34a;' : 'background: #f1f5f9; color: #64748b;'}">${s.status}</span>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #94a3b8; font-size: 11px;">Aucun site</td></tr>'

    // Build complaints rows
    const complaintRows = complaints.length ? complaints.map(cp => `
      <tr>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #1e293b; font-weight: 600;">${cp.title ?? '—'}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; color: #475569;">${fmtDate(cp.createdAt)}</td>
        <td style="padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">
          <span style="padding: 2px 8px; border-radius: 8px; font-weight: 600; ${cp.status === 'RESOLUE' ? 'background: #f0fdf4; color: #16a34a;' : cp.status === 'EN_COURS' ? 'background: #eff6ff; color: #2563eb;' : 'background: #fff7ed; color: #ea580c;'}">${cp.status}</span>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="3" style="padding: 12px; text-align: center; color: #94a3b8; font-size: 11px;">Aucune réclamation</td></tr>'

    // Address
    const addressParts = [
      c.address, c.street2,
      [c.quartier, c.district].filter(Boolean).join(', '),
      [c.city, c.zip].filter(Boolean).join(' '),
      c.country ?? "Côte d'Ivoire",
    ].filter(Boolean)

    // Identification rows
    const idRows = [
      { label: 'RCCM', value: c.rccm }, { label: 'NCC', value: c.ncc },
      { label: 'N° CNI', value: c.cniNumber }, { label: 'TVA', value: c.vat },
      { label: 'Tax ID', value: c.taxId },
    ].filter(r => r.value)

    const idRowsHtml = idRows.length ? idRows.map(r => `
      <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f1f5f9;">
        <span style="font-size: 11px; color: #64748b;">${r.label}</span>
        <span style="font-size: 11px; color: #1e293b; font-weight: 600;">${r.value}</span>
      </div>
    `).join('') : '<p style="font-size: 11px; color: #94a3b8;">Aucune information fiscale</p>'

    // Coordonnées
    const coordItems = [
      { label: 'Téléphone 1', value: c.phone }, { label: 'Téléphone 2', value: c.phone2 },
      { label: 'Mobile', value: c.mobile }, { label: 'Email', value: c.email },
      { label: 'Site web', value: c.website },
    ].filter(r => r.value)

    const coordHtml = coordItems.length ? coordItems.map(r => `
      <div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f1f5f9;">
        <span style="font-size: 11px; color: #64748b;">${r.label}</span>
        <span style="font-size: 11px; color: #1e293b; font-weight: 600;">${r.value}</span>
      </div>
    `).join('') : '<p style="font-size: 11px; color: #94a3b8;">Aucune coordonnée</p>'

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; }
    .page { width: 100%; padding: 0; }

    .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 25px; }
    .logo-block { display: flex; align-items: center; gap: 12px; }
    .logo-block .company { font-size: 14px; font-weight: bold; color: #1e293b; letter-spacing: 1px; }
    .logo-block .tagline { font-size: 11px; font-style: italic; color: #C8A000; }

    .doc-title { font-size: 20px; font-weight: 900; color: #1e293b; text-align: right; }
    .doc-subtitle { font-size: 11px; color: #64748b; text-align: right; margin-top: 4px; }

    .reg-line { font-size: 9px; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 20px; }

    .client-banner { display: flex; align-items: center; gap: 16px; padding: 16px 20px; background: #f8fafc; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #C8A000; }
    .client-banner .name { font-size: 18px; font-weight: 900; color: #1e293b; }
    .client-banner .meta { font-size: 11px; color: #64748b; margin-top: 4px; }
    .status-badge { padding: 4px 12px; border-radius: 12px; font-size: 11px; font-weight: 700; color: #fff; background: ${stColor}; }

    .stats-row { display: flex; gap: 12px; margin-bottom: 20px; }
    .stat-card { flex: 1; padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center; }
    .stat-card .value { font-size: 22px; font-weight: 900; color: #1e293b; }
    .stat-card .label { font-size: 10px; color: #64748b; margin-top: 2px; }
    .stat-card.highlight { background: rgba(200,160,0,0.06); border-color: rgba(200,160,0,0.2); }
    .stat-card.highlight .value { color: #C8A000; }

    .section { margin-bottom: 18px; page-break-inside: avoid; }
    .section-title { font-size: 12px; font-weight: 900; color: #C8A000; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid rgba(200,160,0,0.15); }

    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 18px; page-break-inside: avoid; }
    .info-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 14px; }
    .info-box .box-title { font-size: 10px; font-weight: 700; color: #475569; text-transform: uppercase; margin-bottom: 8px; }

    .addr-line { font-size: 11px; color: #334155; line-height: 1.7; }

    table.data { width: 100%; border-collapse: collapse; margin-bottom: 18px; page-break-inside: avoid; }
    table.data thead tr { background: rgba(200,160,0,0.08); }
    table.data th { text-align: left; padding: 8px 10px; font-size: 10px; font-weight: 700; color: #C8A000; text-transform: uppercase; border-bottom: 2px solid rgba(200,160,0,0.15); }
    table.data th.right { text-align: right; }
    table.data tr { page-break-inside: avoid; }

    .notes-box { margin-bottom: 18px; padding: 12px 14px; background: #f8fafc; border-left: 4px solid #C8A000; border-radius: 4px; font-size: 11px; color: #334155; line-height: 1.6; page-break-inside: avoid; }

    .stats-row { page-break-inside: avoid; }
    .client-banner { page-break-inside: avoid; }
    .header { page-break-inside: avoid; }
  </style>
</head>
<body>
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div class="logo-block">
        <img src="${LOGO_BASE64}" alt="SAGARD" style="width: 70px; height: 70px; object-fit: contain;" />
        <div>
          <div class="company">SAGARD SECURITE</div>
          <div class="tagline">Service d'assistance et de gardiennage sécurité</div>
        </div>
      </div>
      <div>
        <div class="doc-title">FICHE CLIENT</div>
        <div class="doc-subtitle">${c.code ?? ''} · ${fmtDate(new Date())}</div>
      </div>
    </div>

    <div class="reg-line">
      SAGARD SÉCURITÉ · NCC : 1712198T · RCCM : CI-ABJ-2016-B-24910 · Régime TEE
    </div>

    <!-- Client banner -->
    <div class="client-banner">
      <div style="flex: 1;">
        <div class="name">${c.name}</div>
        ${c.legalName && c.legalName !== c.name ? `<div class="meta">${c.legalName}</div>` : ''}
        <div class="meta">
          ${segmentLabels[c.segment] ?? c.segment ?? ''}
          ${c.sector ? ` · ${c.sector}` : ''}
          ${c.city ? ` · ${c.city}` : ''}
        </div>
      </div>
      <div class="status-badge">${stLabel}</div>
    </div>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-card"><div class="value">${contracts.length}</div><div class="label">Contrats</div></div>
      <div class="stat-card"><div class="value">${invoices.length}</div><div class="label">Factures</div></div>
      <div class="stat-card"><div class="value">${sites.length}</div><div class="label">Sites</div></div>
      <div class="stat-card"><div class="value">${contacts.length}</div><div class="label">Contacts</div></div>
      <div class="stat-card highlight"><div class="value">${fmtMoney(stats.totalFacturé)}</div><div class="label">CA Total (F CFA)</div></div>
    </div>

    <!-- Identification + Coordonnées -->
    <div class="two-col">
      <div class="info-box">
        <div class="box-title">Identification fiscale</div>
        ${idRowsHtml}
        <div style="display: flex; justify-content: space-between; padding: 5px 0;">
          <span style="font-size: 11px; color: #64748b;">Créé le</span>
          <span style="font-size: 11px; color: #1e293b; font-weight: 600;">${fmtDate(c.createdAt)}</span>
        </div>
      </div>
      <div class="info-box">
        <div class="box-title">Coordonnées</div>
        ${coordHtml}
      </div>
    </div>

    <!-- Adresse -->
    <div class="section">
      <div class="section-title">Adresse</div>
      <div class="info-box">
        ${addressParts.map(p => `<p class="addr-line">${p}</p>`).join('')}
        ${c.latitude && c.longitude ? `<p class="addr-line" style="color: #94a3b8; margin-top: 6px;">GPS : ${c.latitude}, ${c.longitude}</p>` : ''}
      </div>
    </div>

    <!-- Contacts -->
    <div class="section">
      <div class="section-title">Contacts (${contacts.length})</div>
      <table class="data">
        <thead>
          <tr>
            <th>Nom</th><th>Fonction</th><th>Téléphone</th><th>Email</th><th>WhatsApp</th>
          </tr>
        </thead>
        <tbody>${contactRows}</tbody>
      </table>
    </div>

    <!-- Contrats -->
    <div class="section">
      <div class="section-title">Contrats (${contracts.length})</div>
      <table class="data">
        <thead>
          <tr>
            <th>Référence</th><th>Type</th><th>Début</th><th class="right">Montant/mois</th><th>Statut</th>
          </tr>
        </thead>
        <tbody>${contractRows}</tbody>
      </table>
    </div>

    <!-- Sites -->
    <div class="section">
      <div class="section-title">Sites gardiennés (${sites.length})</div>
      <table class="data">
        <thead>
          <tr>
            <th>Nom</th><th>Adresse</th><th>Ville</th><th>Statut</th>
          </tr>
        </thead>
        <tbody>${siteRows}</tbody>
      </table>
    </div>

    <!-- Factures -->
    <div class="section">
      <div class="section-title">Factures (${invoices.length})</div>
      <table class="data">
        <thead>
          <tr>
            <th>Référence</th><th>Date</th><th>Statut</th><th class="right">Montant</th>
          </tr>
        </thead>
        <tbody>${invoiceRows}</tbody>
      </table>
    </div>

    <!-- Réclamations -->
    <div class="section">
      <div class="section-title">Réclamations (${complaints.length})</div>
      <table class="data">
        <thead>
          <tr>
            <th>Titre</th><th>Date</th><th>Statut</th>
          </tr>
        </thead>
        <tbody>${complaintRows}</tbody>
      </table>
    </div>

    ${c.notes ? `
      <div class="notes-box">
        <strong>Notes :</strong><br>${String(c.notes).replace(/\n/g, '<br>')}
      </div>
    ` : ''}
  </div>
</body>
</html>`

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'domcontentloaded' })
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', bottom: '18mm', left: '12mm', right: '12mm' },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
          <div style="width: 100%; font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #94a3b8; display: flex; justify-content: center; padding: 0 12mm;">
            <span>✉ directionsagardci@gmail.com &nbsp; ☎ +225 0749 800 080 / 2723266641 &nbsp; 🌐 www.sagard.ci</span>
          </div>
        `,
      })
      return Buffer.from(pdfBuffer)
    } finally {
      await browser.close()
    }
  }
}
