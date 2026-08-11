import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common'
import * as nodemailer from 'nodemailer'
import * as puppeteer from 'puppeteer'
import { PrismaService } from '../prisma/prisma.service'
import { SettingsService } from '../settings/settings.service'
import { LOGO_BASE64 } from './logo.constant'
import { generateQrSvg } from './qr-svg.util'

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name)
  private transporter: nodemailer.Transporter

  constructor(
    private prisma: PrismaService,
    private settingsService: SettingsService,
  ) {
    this.initTransporter()
  }

  private initTransporter() {
    const host = process.env.SMTP_HOST
    const port = Number(process.env.SMTP_PORT || 587)
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASS

    if (!host || !user || !pass) {
      this.logger.warn('SMTP configuration is missing. Emails cannot be sent.')
      return
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false,
      },
    })
  }

  /**
   * Generate a PDF buffer from the invoice HTML using Puppeteer
   */
  async generateInvoicePdf(inv: any, company: any, docType: string): Promise<Buffer> {
    const totalAmount = Number(inv.totalAmount)
    const formattedTotal = new Intl.NumberFormat('fr-FR').format(totalAmount)
    const isPaid = inv.status === 'PAYEE'
    const isPartial = inv.status === 'PARTIELLEMENT_PAYEE'
    const paidAmount = Number(inv.paidAmount ?? 0)
    const remainingAmount = totalAmount - paidAmount
    const clientName = inv.client?.name ?? inv.lead?.companyName ?? inv.lead?.contactName ?? 'Client'

    // Clean description helper — strip service code prefixes like [[CYNO-N]_C]
    const cleanDesc = (desc: string) => {
      if (!desc) return ''
      return desc.replace(/^(\s*\[[^\]]+\]\s*)+/, '').trim()
    }

    // Build invoice lines table rows
    let tableRows = ''
    for (const line of inv.lines) {
      const quantity = Number(line.quantity)
      const unitPrice = Number(line.unitPrice)
      const lineTotal = quantity * unitPrice
      tableRows += `
        <tr>
          <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #334155; font-size: 12px;">${cleanDesc(line.description)}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 12px; text-align: center;">${quantity.toFixed(2)} Unité(s)</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #475569; font-size: 12px; text-align: right;">${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(unitPrice)}</td>
          <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-size: 12px; text-align: right; font-weight: bold;">${new Intl.NumberFormat('fr-FR').format(lineTotal)} F CFA</td>
        </tr>
      `
    }

    // Client info lines
    const clientAddress = [
      inv.client?.neighborhood, inv.client?.district, inv.client?.city,
    ].filter(Boolean).join(', ')

    const paymentLink = 'https://pay.djamo.com/3waob'

    // Generate QR code SVG (no external network dependency)
    const qrSvg = await generateQrSvg(paymentLink, 90)

    // Payment method label
    const payMethodLabels: Record<string, string> = {
      CHEQUE: 'Chèque', VIREMENT_BANCAIRE: 'Virement bancaire',
      MOBILE_MONEY: 'Mobile Money', ESPECE: 'Espèces',
    }
    const paymentMethodLabel = inv.paymentMethod ? (payMethodLabels[inv.paymentMethod] ?? inv.paymentMethod) : '—'

    const rccmNcc = inv.client?.rccm || inv.client?.ncc
      ? `${inv.client.rccm ?? ''} ${inv.client.ncc ? '/ ' + inv.client.ncc : ''}`.trim()
      : '—'

    const issueDate = new Date(inv.issueDate).toLocaleDateString('fr-FR')
    const dueDate = new Date(inv.dueDate).toLocaleDateString('fr-FR')

    const pdfHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; }
    .page { width: 210mm; min-height: 297mm; padding: 40px 45px 30px; position: relative; display: flex; flex-direction: column; }

    /* Ribbon */
    .ribbon-wrap { position: absolute; top: 0; right: 0; width: 180px; height: 180px; overflow: hidden; }
    .ribbon { position: absolute; top: 34px; right: -60px; width: 280px; text-align: center; padding: 9px 0; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #fff; transform: rotate(45deg); }
    .ribbon.paid { background: #16a34a; }
    .ribbon.unpaid { background: #dc2626; }
    .ribbon.partial { background: #f59e0b; }

    .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 30px; }
    .logo-block { display: flex; align-items: center; gap: 12px; }
    .logo-block .company { font-size: 14px; font-weight: bold; color: #1e293b; letter-spacing: 1px; }
    .logo-block .tagline { font-size: 11px; font-style: italic; color: #C8A000; }

    .client-ref { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .client-info { font-size: 12px; color: #334155; line-height: 1.6; }
    .client-info .name { font-weight: bold; }
    .doc-ref { font-size: 22px; font-weight: bold; color: #1e293b; text-align: right; }

    .reg-line { font-size: 9px; color: #64748b; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px; }

    .info-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; border: 1px solid #cbd5e1; margin-bottom: 20px; }
    .info-cell { padding: 8px 10px; border-right: 1px solid #cbd5e1; font-size: 11px; }
    .info-cell:last-child { border-right: none; }
    .info-cell .label { font-weight: bold; color: #475569; }
    .info-cell .value { color: #1e293b; margin-top: 2px; }

    .notes-box { margin-bottom: 20px; padding: 12px; background: #f8fafc; border-left: 4px solid #C8A000; font-size: 12px; color: #334155; }
    .notes-box .notes-title { font-weight: bold; color: #1e293b; margin-bottom: 4px; }

    table.lines { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    table.lines thead tr { background: rgba(200, 160, 0, 0.12); }
    table.lines th { text-align: left; padding: 10px 12px; font-size: 10px; font-weight: bold; color: #C8A000; text-transform: uppercase; border: 1px solid rgba(200, 160, 0, 0.25); }
    table.lines th.center { text-align: center; }
    table.lines th.right { text-align: right; }
    table.lines td { border: 1px solid #e2e8f0; }

    .totals { display: flex; justify-content: flex-end; margin-bottom: 30px; }
    .totals-box { width: 260px; border: 1px solid #e2e8f0; }
    .totals-row { display: flex; align-items: center; border-bottom: 1px solid #e2e8f0; }
    .totals-row:last-child { border-bottom: none; }
    .totals-row .totals-label { flex: 1; padding: 8px 12px; font-size: 12px; font-weight: bold; }
    .totals-row .totals-value { padding: 8px 12px; font-size: 12px; font-weight: 900; text-align: right; }
    .totals-row.main .totals-label { background: rgba(200, 160, 0, 0.08); color: #C8A000; border-right: 1px solid rgba(200, 160, 0, 0.25); }
    .totals-row.paid { background: #f0fdf4; }
    .totals-row.paid .totals-label, .totals-row.paid .totals-value { color: #16a34a; }
    .totals-row.due { background: #fef2f2; }
    .totals-row.due .totals-label, .totals-row.due .totals-value { color: #dc2626; }
    .totals-row.due-paid { background: #f0fdf4; }
    .totals-row.due-paid .totals-label, .totals-row.due-paid .totals-value { color: #16a34a; }
    .totals-row.partial { background: #fffbeb; }
    .totals-row.partial .totals-label, .totals-row.partial .totals-value { color: #d97706; }
    .totals-row.remaining { background: #fef2f2; }
    .totals-row.remaining .totals-label, .totals-row.remaining .totals-value { color: #dc2626; }

    .payment-com { font-size: 12px; color: #334155; margin-bottom: 20px; }
    .payment-com a { color: #2563eb; }

    .qr-section { display: flex; align-items: flex-start; gap: 12px; margin-bottom: auto; }
    .qr-section .qr-text { font-size: 13px; font-weight: 900; color: #1e293b; }
    .qr-section .qr-sub { font-size: 11px; font-style: italic; color: #C8A000; }

    .spacer { flex: 1; }

    .footer { border-top: 1px solid #cbd5e1; padding-top: 12px; margin-top: 30px; }
    .footer-row { display: flex; justify-content: space-between; font-size: 10px; color: #475569; }
    .footer-center { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="page">
    ${inv.type === 'FACTURE' ? `
      <div class="ribbon-wrap">
        <div class="ribbon ${isPaid ? 'paid' : isPartial ? 'partial' : 'unpaid'}">${isPaid ? 'PAYÉE' : isPartial ? 'PARTIELLEMENT<br>PAYÉE' : 'NON PAYÉE'}</div>
      </div>
    ` : ''}

    <div class="header">
      <div class="logo-block">
        <img src="${LOGO_BASE64}" alt="SAGARD" style="width: 80px; height: 80px; object-fit: contain;" />
        <div>
          <div class="company">SAGARD SECURITE</div>
          <div class="tagline">Service d'assistance et de gardiennage sécurité</div>
        </div>
      </div>
    </div>

    <div class="client-ref">
      <div class="client-info">
        <p class="name">${clientName}</p>
        ${clientAddress ? `<p>${clientAddress}</p>` : ''}
        <p>Côte d'Ivoire</p>
        ${inv.client?.rccm ? `<p>RCCM : ${inv.client.rccm}</p>` : ''}
        ${inv.client?.ncc ? `<p>NCC : ${inv.client.ncc}</p>` : ''}
      </div>
      <div class="doc-ref">${docType} ${inv.reference}</div>
    </div>

    <div class="reg-line">
      SAGARD SÉCURITÉ · NCC : 1712198T · RCCM : CI-ABJ-2016-B-24910 · Régime TEE
    </div>

    <div class="info-grid">
      <div class="info-cell">
        <div class="label">Date de facturation</div>
        <div class="value">${issueDate}</div>
      </div>
      <div class="info-cell">
        <div class="label">Échéance</div>
        <div class="value">${dueDate}</div>
      </div>
      <div class="info-cell">
        <div class="label">RCCM / NCC client</div>
        <div class="value">${rccmNcc}</div>
      </div>
      <div class="info-cell">
        <div class="label">Mode de paiement</div>
        <div class="value">${paymentMethodLabel}</div>
      </div>
    </div>

    ${inv.notes ? `
      <div class="notes-box">
        <div class="notes-title">Note :</div>
        <div>${inv.notes.replace(/\n/g, '<br>')}</div>
      </div>
    ` : ''}

    <table class="lines">
      <thead>
        <tr>
          <th>Description</th>
          <th class="center" style="width: 90px;">Quantité</th>
          <th class="right" style="width: 110px;">Prix unitaire</th>
          <th class="right" style="width: 110px;">Montant</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-box">
        <div class="totals-row main">
          <div class="totals-label">Total TTC</div>
          <div class="totals-value">${formattedTotal} F CFA</div>
        </div>
        ${inv.type === 'FACTURE' && (isPaid || isPartial) ? `
          <div class="totals-row ${isPartial ? 'partial' : 'paid'}">
            <div class="totals-label">${isPartial ? 'Acompte versé' : 'Montant payé'}</div>
            <div class="totals-value">${new Intl.NumberFormat('fr-FR').format(paidAmount)} F CFA</div>
          </div>
        ` : ''}
        ${inv.type === 'FACTURE' ? `
          <div class="totals-row ${isPaid ? 'due-paid' : 'remaining'}">
            <div class="totals-label">Solde restant</div>
            <div class="totals-value">${isPaid ? '0 F CFA' : `${new Intl.NumberFormat('fr-FR').format(remainingAmount)} F CFA`}</div>
          </div>
        ` : ''}
      </div>
    </div>

    <div class="payment-com">
      <p><strong>Communication de paiement :</strong> ${inv.reference}</p>
      <p>sur ce compte : <a href="${paymentLink}">${paymentLink}</a></p>
    </div>

    <div class="qr-section">
      <div style="width: 90px; height: 90px; border: 1px solid #e2e8f0; padding: 4px; box-sizing: content-box;">
        ${qrSvg}
      </div>
      <div style="padding-top: 8px;">
        <div class="qr-text">PAYEZ EN UN CLIN D'ŒIL !</div>
        <div class="qr-sub">Scannez le QR code</div>
        <div class="qr-sub">ou cliquez pour payer en ligne</div>
      </div>
    </div>

    <div class="spacer"></div>

    <div class="footer">
      <div class="footer-row">
        <span>✉ ${company.email || 'directionsagardci@gmail.com'}</span>
        <span>☎ ${company.phone || '+225 0749 800 080 / 2723266641'}</span>
        <span>🌐 www.sagard.ci</span>
      </div>
      <div class="footer-center">Page 1/1</div>
    </div>
  </div>
</body>
</html>`

    // Launch Puppeteer and generate PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    try {
      const page = await browser.newPage()
      await page.setContent(pdfHtml, { waitUntil: 'domcontentloaded' })
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', bottom: '0', left: '0', right: '0' },
      })
      return Buffer.from(pdfBuffer)
    } finally {
      await browser.close()
    }
  }

  async sendInvoiceEmail(invoiceId: string) {
    if (!this.transporter) {
      throw new BadRequestException("Le service SMTP n'est pas configuré. Veuillez vérifier les variables d'environnement.")
    }

    const inv = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: {
          include: {
            contacts: {
              orderBy: { isPrimary: 'desc' },
            },
          },
        },
        lead: true,
        lines: true,
      },
    })

    if (!inv) throw new NotFoundException('Facture introuvable')

    // Find destination email
    let destEmail = ''
    let clientName = ''

    if (inv.client) {
      clientName = inv.client.name
      const primaryContact = inv.client.contacts.find(c => c.isPrimary)
      destEmail = primaryContact?.email || inv.client.contacts[0]?.email || inv.client.email || ''
    } else if (inv.lead) {
      clientName = inv.lead.companyName || inv.lead.contactName || 'Client'
      destEmail = inv.lead.contactEmail || ''
    }

    if (!destEmail) {
      throw new BadRequestException("Aucune adresse e-mail de destination n'a été trouvée pour ce client.")
    }

    // Get company settings
    const company = await this.settingsService.getSettings()
    const fromName = process.env.SMTP_FROM_NAME || company.name
    const fromEmail = company.email || process.env.SMTP_USER

    const docType = inv.type === 'DEVIS' ? 'Devis' : inv.type === 'PROFORMA' ? 'Facture Proforma' : 'Facture'
    const totalAmount = Number(inv.totalAmount)
    const formattedTotal = new Intl.NumberFormat('fr-FR').format(totalAmount)
    const isPaid = inv.status === 'PAYEE'
    const isPartial = inv.status === 'PARTIELLEMENT_PAYEE'
    const paidAmount = Number(inv.paidAmount ?? 0)
    const formattedPaid = new Intl.NumberFormat('fr-FR').format(paidAmount)
    const remainingAmount = totalAmount - paidAmount
    const formattedRemaining = new Intl.NumberFormat('fr-FR').format(remainingAmount)

    // Generate PDF attachment — fallback to no attachment if Puppeteer fails
    let pdfBuffer: Buffer | null = null
    let fileName = `${docType.replace(/ /g, '_')}_${inv.reference}.pdf`
    try {
      this.logger.log(`Generating PDF for ${inv.reference}...`)
      pdfBuffer = await this.generateInvoicePdf(inv, company, docType)
      this.logger.log(`PDF generated (${(pdfBuffer.length / 1024).toFixed(1)} KB)`)
    } catch (pdfErr: any) {
      this.logger.error(`PDF generation failed for ${inv.reference}: ${pdfErr?.message}`, pdfErr?.stack)
    }

    // ─── Email body — customized based on invoice type and payment status ───
    const isProforma = inv.type === 'PROFORMA'

    const textContent = isProforma
      ? `Cher(e) ${clientName},

Nous vous remercions de l'intérêt porté aux services de SAGARD SÉCURITÉ.

Veuillez trouver ci-joint notre facture pro forma n° ${inv.reference}, d'un montant de ${formattedTotal} FCFA, établie conformément à votre demande.

Cette facture pro forma est émise à titre de proposition commerciale et ne constitue pas une facture définitive. Dès réception de votre accord ou du règlement, selon les conditions convenues, nous procéderons aux étapes suivantes de votre commande.

Pour toute information complémentaire, notre équipe reste à votre entière disposition.

Nous vous remercions de votre confiance.

SAGARD SÉCURITÉ
Service Commercial`
      : isPaid
      ? `Cher(e) ${clientName},

Nous confirmons la réception de votre règlement d'un montant de ${formattedTotal} FCFA au titre de la facture n° ${inv.reference}.

Nous vous remercions pour votre diligence et pour la confiance que vous accordez à SAGARD SÉCURITÉ.

Nous restons à votre disposition pour tout besoin en matière de sécurité privée et de solutions de sûreté.

SAGARD SÉCURITÉ
Service Administratif et Financier`
      : isPartial
      ? `Cher(e) ${clientName},

Nous vous remercions pour votre règlement de ${formattedPaid} FCFA, reçu au titre de la facture n° ${inv.reference}.

Après prise en compte de ce paiement, le solde restant dû est de ${formattedRemaining} FCFA.

Nous vous invitons à procéder au règlement de ce solde dans les meilleurs délais, conformément aux conditions convenues, afin d'éviter toute suspension de nos prestations et d'assurer la continuité de nos services.

Pour toute information complémentaire, notre service administratif et financier reste à votre disposition.

Nous vous remercions de votre confiance.

SAGARD SÉCURITÉ
Service Administratif et Financier`
      : `Cher(e) ${clientName},

Nous vous informons que votre facture n° ${inv.reference}, d'un montant de ${formattedTotal} FCFA, a été générée et mise à votre disposition.

Nous vous remercions de bien vouloir procéder à son règlement selon les conditions convenues.

Pour toute question relative à cette facture, notre service administratif et financier reste à votre disposition.

Nous vous remercions pour votre confiance.

SAGARD SÉCURITÉ
Service Administratif et Financier`

    const emailBodyText = isProforma
      ? `Nous vous remercions de l'intérêt porté aux services de SAGARD SÉCURITÉ.<br><br>Veuillez trouver ci-joint notre facture pro forma n° <strong>${inv.reference}</strong>, d'un montant de <strong>${formattedTotal} FCFA</strong>, établie conformément à votre demande.`
      : isPaid
      ? `Nous confirmons la réception de votre règlement d'un montant de <strong>${formattedTotal} FCFA</strong> au titre de la facture n° <strong>${inv.reference}</strong>.`
      : isPartial
      ? `Nous vous remercions pour votre règlement de <strong>${formattedPaid} FCFA</strong>, reçu au titre de la facture n° <strong>${inv.reference}</strong>.<br><br>Après prise en compte de ce paiement, le solde restant dû est de <strong>${formattedRemaining} FCFA</strong>.`
      : `Nous vous informons que votre facture n° <strong>${inv.reference}</strong>, d'un montant de <strong>${formattedTotal} FCFA</strong>, a été générée et mise à votre disposition.`

    const emailClosingText = isProforma
      ? `Cette facture pro forma est émise à titre de proposition commerciale et ne constitue pas une facture définitive. Dès réception de votre accord ou du règlement, selon les conditions convenues, nous procéderons aux étapes suivantes de votre commande.<br><br>Pour toute information complémentaire, notre équipe reste à votre entière disposition.<br><br>Nous vous remercions de votre confiance.`
      : isPaid
      ? `Nous vous remercions pour votre diligence et pour la confiance que vous accordez à SAGARD SÉCURITÉ.<br><br>Nous restons à votre disposition pour tout besoin en matière de sécurité privée et de solutions de sûreté.`
      : isPartial
      ? `Nous vous invitons à procéder au règlement de ce solde dans les meilleurs délais, conformément aux conditions convenues, afin d'éviter toute suspension de nos prestations et d'assurer la continuité de nos services.<br><br>Pour toute information complémentaire, notre service administratif et financier reste à votre disposition.<br><br>Nous vous remercions de votre confiance.`
      : `Nous vous remercions de bien vouloir procéder à son règlement selon les conditions convenues.<br><br>Pour toute question relative à cette facture, notre service administratif et financier reste à votre disposition.<br><br>Nous vous remercions pour votre confiance.`

    const signatureService = isProforma ? 'Service Commercial' : 'Service Administratif et Financier'

    const pdfNoteText = pdfBuffer
      ? 'Le détail complet est disponible dans le fichier PDF ci-joint.'
      : 'Le détail complet de ce document est disponible sur demande auprès de notre service administratif.'

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
    <!-- Header -->
    <div style="background-color: #1e293b; padding: 20px; text-align: center; border-bottom: 3px solid #C8A000;">
      <h1 style="color: #ffffff; margin: 0; font-size: 18px; font-weight: bold; letter-spacing: 1px;">SAGARD SÉCURITÉ</h1>
      <p style="color: #94a3b8; margin: 4px 0 0; font-size: 11px; font-style: italic;">Sécurité, Assistance et Gardiennage</p>
    </div>

    <!-- Content -->
    <div style="padding: 28px 24px;">
      <p style="font-size: 15px; color: #334155; margin: 0 0 16px;">Cher(e) <strong>${clientName}</strong>,</p>
      <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px;">
        ${emailBodyText}
      </p>

      <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px;">
        ${emailClosingText}
      </p>

      <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;">
        ${pdfNoteText}
      </p>
    </div>

    <!-- Signature -->
    <div style="padding: 0 24px 20px;">
      <p style="font-size: 14px; color: #1e293b; font-weight: bold; margin: 0;">SAGARD SÉCURITÉ</p>
      <p style="font-size: 13px; color: #64748b; margin: 2px 0 0;">${signatureService}</p>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">
      <p style="margin: 0 0 4px;"><strong>${company.name}</strong></p>
      <p style="margin: 0 0 4px;">${company.address || "Abidjan, Côte d'Ivoire"} · Tél : ${company.phone || '+225 0749 800 080'}</p>
      <p style="margin: 0;">Email : ${company.email || fromEmail} · Web : www.sagard.ci</p>
    </div>
  </div>
</body>
</html>`

    const mailOptions: nodemailer.SendMailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: destEmail,
      replyTo: fromEmail,
      subject: `${docType} N° ${inv.reference} — ${fromName}`,
      text: textContent,   // Plain text version (important for anti-spam)
      html: htmlContent,
      headers: {
        'X-Mailer': 'SAGARD ERP',
        'X-Priority': '3',  // Normal priority
      },
      attachments: pdfBuffer
        ? [{ filename: fileName, content: pdfBuffer, contentType: 'application/pdf' }]
        : [],
    }

    try {
      const info = await this.transporter.sendMail(mailOptions)
      this.logger.log(`Email envoyé pour ${inv.reference} à ${destEmail}${pdfBuffer ? ' avec PDF joint' : ' (sans PDF)'} (Message ID: ${info.messageId})`)
      return { success: true, messageId: info.messageId, to: destEmail, hasAttachment: !!pdfBuffer }
    } catch (smtpErr: any) {
      this.logger.error(`SMTP error sending email to ${destEmail}: ${smtpErr?.message}`, smtpErr?.stack)
      throw new BadRequestException(`Erreur d'envoi SMTP : ${smtpErr?.message || 'Erreur inconnue'}`)
    }
  }

  /**
   * Send invoice email with an additional attachment from the user's computer
   */
  async sendInvoiceEmailWithAttachment(invoiceId: string, attachment: { filename: string; content: Buffer }) {
    if (!this.transporter) {
      throw new BadRequestException("Le service SMTP n'est pas configuré. Veuillez vérifier les variables d'environnement.")
    }

    const inv = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        client: { include: { contacts: { orderBy: { isPrimary: 'desc' } } } },
        lead: true,
        lines: true,
      },
    })

    if (!inv) throw new NotFoundException('Facture introuvable')

    let destEmail = ''
    let clientName = ''

    if (inv.client) {
      clientName = inv.client.name
      const primaryContact = inv.client.contacts.find(c => c.isPrimary)
      destEmail = primaryContact?.email || inv.client.contacts[0]?.email || inv.client.email || ''
    } else if (inv.lead) {
      clientName = inv.lead.companyName || inv.lead.contactName || 'Client'
      destEmail = inv.lead.contactEmail || ''
    }

    if (!destEmail) {
      throw new BadRequestException("Aucune adresse e-mail de destination n'a été trouvée pour ce client.")
    }

    const company = await this.settingsService.getSettings()
    const fromName = process.env.SMTP_FROM_NAME || company.name
    const fromEmail = company.email || process.env.SMTP_USER
    const docType = inv.type === 'DEVIS' ? 'Devis' : inv.type === 'PROFORMA' ? 'Facture Proforma' : 'Facture'
    const totalAmount = Number(inv.totalAmount)
    const formattedTotal = new Intl.NumberFormat('fr-FR').format(totalAmount)
    const isPaid = inv.status === 'PAYEE'
    const isPartial = inv.status === 'PARTIELLEMENT_PAYEE'
    const paidAmount = Number(inv.paidAmount ?? 0)
    const formattedPaid = new Intl.NumberFormat('fr-FR').format(paidAmount)
    const remainingAmount = totalAmount - paidAmount
    const formattedRemaining = new Intl.NumberFormat('fr-FR').format(remainingAmount)

    this.logger.log(`Generating PDF for ${inv.reference}...`)
    const pdfBuffer = await this.generateInvoicePdf(inv, company, docType)
    this.logger.log(`PDF generated (${(pdfBuffer.length / 1024).toFixed(1)} KB)`)

    const fileName = `${docType.replace(/ /g, '_')}_${inv.reference}.pdf`

    const isProforma = inv.type === 'PROFORMA'

    const textContent = isProforma
      ? `Cher(e) ${clientName},

Nous vous remercions de l'intérêt porté aux services de SAGARD SÉCURITÉ.

Veuillez trouver ci-joint notre facture pro forma n° ${inv.reference}, d'un montant de ${formattedTotal} FCFA, établie conformément à votre demande.

Cette facture pro forma est émise à titre de proposition commerciale et ne constitue pas une facture définitive. Dès réception de votre accord ou du règlement, selon les conditions convenues, nous procéderons aux étapes suivantes de votre commande.

Pour toute information complémentaire, notre équipe reste à votre entière disposition.

Nous vous remercions de votre confiance.

SAGARD SÉCURITÉ
Service Commercial`
      : isPaid
      ? `Cher(e) ${clientName},

Nous confirmons la réception de votre règlement d'un montant de ${formattedTotal} FCFA au titre de la facture n° ${inv.reference}.

Nous vous remercions pour votre diligence et pour la confiance que vous accordez à SAGARD SÉCURITÉ.

Nous restons à votre disposition pour tout besoin en matière de sécurité privée et de solutions de sûreté.

SAGARD SÉCURITÉ
Service Administratif et Financier`
      : isPartial
      ? `Cher(e) ${clientName},

Nous vous remercions pour votre règlement de ${formattedPaid} FCFA, reçu au titre de la facture n° ${inv.reference}.

Après prise en compte de ce paiement, le solde restant dû est de ${formattedRemaining} FCFA.

Nous vous invitons à procéder au règlement de ce solde dans les meilleurs délais, conformément aux conditions convenues, afin d'éviter toute suspension de nos prestations et d'assurer la continuité de nos services.

Pour toute information complémentaire, notre service administratif et financier reste à votre disposition.

Nous vous remercions de votre confiance.

SAGARD SÉCURITÉ
Service Administratif et Financier`
      : `Cher(e) ${clientName},

Nous vous informons que votre facture n° ${inv.reference}, d'un montant de ${formattedTotal} FCFA, a été générée et mise à votre disposition.

Nous vous remercions de bien vouloir procéder à son règlement selon les conditions convenues.

Pour toute question relative à cette facture, notre service administratif et financier reste à votre disposition.

Nous vous remercions pour votre confiance.

SAGARD SÉCURITÉ
Service Administratif et Financier`

    const emailBodyText = isProforma
      ? `Nous vous remercions de l'intérêt porté aux services de SAGARD SÉCURITÉ.<br><br>Veuillez trouver ci-joint notre facture pro forma n° <strong>${inv.reference}</strong>, d'un montant de <strong>${formattedTotal} FCFA</strong>, établie conformément à votre demande.`
      : isPaid
      ? `Nous confirmons la réception de votre règlement d'un montant de <strong>${formattedTotal} FCFA</strong> au titre de la facture n° <strong>${inv.reference}</strong>.`
      : isPartial
      ? `Nous vous remercions pour votre règlement de <strong>${formattedPaid} FCFA</strong>, reçu au titre de la facture n° <strong>${inv.reference}</strong>.<br><br>Après prise en compte de ce paiement, le solde restant dû est de <strong>${formattedRemaining} FCFA</strong>.`
      : `Nous vous informons que votre facture n° <strong>${inv.reference}</strong>, d'un montant de <strong>${formattedTotal} FCFA</strong>, a été générée et mise à votre disposition.`

    const emailClosingText = isProforma
      ? `Cette facture pro forma est émise à titre de proposition commerciale et ne constitue pas une facture définitive. Dès réception de votre accord ou du règlement, selon les conditions convenues, nous procéderons aux étapes suivantes de votre commande.<br><br>Pour toute information complémentaire, notre équipe reste à votre entière disposition.<br><br>Nous vous remercions de votre confiance.`
      : isPaid
      ? `Nous vous remercions pour votre diligence et pour la confiance que vous accordez à SAGARD SÉCURITÉ.<br><br>Nous restons à votre disposition pour tout besoin en matière de sécurité privée et de solutions de sûreté.`
      : isPartial
      ? `Nous vous invitons à procéder au règlement de ce solde dans les meilleurs délais, conformément aux conditions convenues, afin d'éviter toute suspension de nos prestations et d'assurer la continuité de nos services.<br><br>Pour toute information complémentaire, notre service administratif et financier reste à votre disposition.<br><br>Nous vous remercions de votre confiance.`
      : `Nous vous remercions de bien vouloir procéder à son règlement selon les conditions convenues.<br><br>Pour toute question relative à cette facture, notre service administratif et financier reste à votre disposition.<br><br>Nous vous remercions pour votre confiance.`

    const signatureService = isProforma ? 'Service Commercial' : 'Service Administratif et Financier'

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
    <div style="background-color: #1e293b; padding: 20px; text-align: center; border-bottom: 3px solid #C8A000;">
      <h1 style="color: #ffffff; margin: 0; font-size: 18px; font-weight: bold; letter-spacing: 1px;">SAGARD SÉCURITÉ</h1>
      <p style="color: #94a3b8; margin: 4px 0 0; font-size: 11px; font-style: italic;">Sécurité, Assistance et Gardiennage</p>
    </div>
    <div style="padding: 28px 24px;">
      <p style="font-size: 15px; color: #334155; margin: 0 0 16px;">Cher(e) <strong>${clientName}</strong>,</p>
      <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px;">
        ${emailBodyText}
      </p>
      <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 20px;">
        ${emailClosingText}
      </p>
      <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;">
        Le détail complet est disponible dans le fichier PDF ci-joint.
      </p>
    </div>
    <div style="padding: 0 24px 20px;">
      <p style="font-size: 14px; color: #1e293b; font-weight: bold; margin: 0;">SAGARD SÉCURITÉ</p>
      <p style="font-size: 13px; color: #64748b; margin: 2px 0 0;">${signatureService}</p>
    </div>
    <div style="background-color: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center;">
      <p style="margin: 0 0 4px;"><strong>${company.name}</strong></p>
      <p style="margin: 0 0 4px;">${company.address || "Abidjan, Côte d'Ivoire"} · Tél : ${company.phone || '+225 0749 800 080'}</p>
      <p style="margin: 0;">Email : ${company.email || fromEmail} · Web : www.sagard.ci</p>
    </div>
  </div>
</body>
</html>`

    const mailOptions: nodemailer.SendMailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: destEmail,
      replyTo: fromEmail,
      subject: `${docType} N° ${inv.reference} — ${fromName}`,
      text: textContent,
      html: htmlContent,
      headers: { 'X-Mailer': 'SAGARD ERP', 'X-Priority': '3' },
      attachments: [
        { filename: fileName, content: pdfBuffer, contentType: 'application/pdf' },
        { filename: attachment.filename, content: attachment.content },
      ],
    }

    const info = await this.transporter.sendMail(mailOptions)
    this.logger.log(`Email envoyé pour ${inv.reference} à ${destEmail} avec PDF + pièce jointe (Message ID: ${info.messageId})`)
    return { success: true, messageId: info.messageId, to: destEmail }
  }

  /**
   * Generate and return PDF buffer for download
   */
  async downloadInvoicePdf(invoiceId: string): Promise<{ buffer: Buffer; filename: string }> {
    const inv = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true, lead: true, lines: true },
    })
    if (!inv) throw new NotFoundException('Facture introuvable')

    const company = await this.settingsService.getSettings()
    const docType = inv.type === 'DEVIS' ? 'Devis' : inv.type === 'PROFORMA' ? 'Facture Proforma' : 'Facture'
    const buffer = await this.generateInvoicePdf(inv, company, docType)
    const filename = `${docType.replace(/ /g, '_')}_${inv.reference}.pdf`
    return { buffer, filename }
  }
}
