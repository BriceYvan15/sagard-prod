import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'

export interface WhatsAppMessage {
  to: string
  type: 'text' | 'template'
  text?: string
  templateName?: string
  templateParams?: string[]
}

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name)
  private readonly apiUrl = process.env.WHATSAPP_API_URL
  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  private readonly token = process.env.WHATSAPP_ACCESS_TOKEN

  async sendMessage(msg: WhatsAppMessage): Promise<boolean> {
    if (!this.token || !this.phoneNumberId) {
      this.logger.warn('WhatsApp non configuré — message non envoyé')
      return false
    }

    try {
      const phone = msg.to.replace(/\D/g, '').replace(/^0/, '225')
      const payload = msg.type === 'text'
        ? {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'text',
            text: { body: msg.text },
          }
        : {
            messaging_product: 'whatsapp',
            to: phone,
            type: 'template',
            template: {
              name: msg.templateName,
              language: { code: 'fr' },
              components: msg.templateParams
                ? [{ type: 'body', parameters: msg.templateParams.map(p => ({ type: 'text', text: p })) }]
                : [],
            },
          }

      await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        payload,
        { headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' } },
      )
      this.logger.log(`WhatsApp envoyé à ${phone}`)
      return true
    } catch (err: any) {
      this.logger.error(`Erreur WhatsApp: ${err.message}`)
      return false
    }
  }

  async notifyClientComplaint(clientPhone: string, complaintRef: string, clientName: string) {
    return this.sendMessage({
      to: clientPhone,
      type: 'text',
      text: `*SAGARD SÉCURITÉ* ✅\n\nBonjour ${clientName},\n\nVotre réclamation *${complaintRef}* a bien été reçue.\nNotre équipe vous contactera sous 24h.\n\n_Merci de votre confiance._`,
    })
  }

  async notifyEquipmentAssignment(agentPhone: string, agentName: string, equipmentName: string, assignedBy: string) {
    return this.sendMessage({
      to: agentPhone,
      type: 'text',
      text: `*SAGARD SÉCURITÉ* 🔧\n\nBonjour *${agentName}*,\n\nVous avez reçu l'équipement : *${equipmentName}*\n\nAssigné par : ${assignedBy}\nDate : ${new Date().toLocaleDateString('fr-FR')}\n\nPrenez soin de ce matériel.`,
    })
  }

  async notifyDGEquipmentAssignment(dgPhone: string, agentName: string, equipmentName: string) {
    return this.sendMessage({
      to: dgPhone,
      type: 'text',
      text: `*SAGARD SÉCURITÉ* — Info DG 📋\n\nÉquipement *${equipmentName}* assigné à l'agent *${agentName}*.\n\nDate : ${new Date().toLocaleDateString('fr-FR')}`,
    })
  }

  async notifyAgentDeployment(agentPhone: string, agentName: string, siteName: string, shift: string, startDate: string) {
    return this.sendMessage({
      to: agentPhone,
      type: 'text',
      text: `*SAGARD SÉCURITÉ* 🛡️\n\nBonjour *${agentName}*,\n\nVous êtes affecté(e) au site :\n📍 *${siteName}*\n🕐 Vacation : *${shift}*\n📅 Date de début : *${startDate}*\n\nBonne prise de service.`,
    })
  }

  async notifyInvoiceOverdue(clientPhone: string, clientName: string, invoiceRef: string, amount: string, daysLate: number) {
    return this.sendMessage({
      to: clientPhone,
      type: 'text',
      text: `*SAGARD SÉCURITÉ* — Relance 🔔\n\nBonjour *${clientName}*,\n\nNous vous informons que la facture *${invoiceRef}* d'un montant de *${amount} XOF* est en retard de *${daysLate} jours*.\n\nMerci de régulariser dans les meilleurs délais.\n\nContact : +225 2723 434 624`,
    })
  }

  async notifyControllerMoveToSite(coPhone: string, controllerName: string, siteName: string, time: string) {
    return this.sendMessage({
      to: coPhone,
      type: 'text',
      text: `*SAGARD SÉCURITÉ* — Mouvement Contrôleur 📍\n\n*${controllerName}* est arrivé sur le site :\n🏢 *${siteName}*\n🕐 ${time}`,
    })
  }
}
