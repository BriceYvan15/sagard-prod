import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'

@Injectable()
export class HrService {
  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  // ── Paie (Payroll = document mensuel global + PayrollLine par agent) ──
  async getPayrolls(filters?: { month?: number; year?: number }) {
    return this.prisma.payroll.findMany({
      where: {
        ...(filters?.month && { month: filters.month }),
        ...(filters?.year  && { year:  filters.year  }),
      },
      include: { lines: { include: { agent: { include: { user: { select: { firstName: true, lastName: true } } } } } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })
  }

  // ── Calcul paie Sénégal / UEMOA ──
  private computePayslip(baseSalary: number, daysWorked: number, overtimeHours: number) {
    const dailyRate = baseSalary / 26
    const salaireBrut = Math.round(dailyRate * daysWorked)

    // Primes
    const primeTransport = 26000       // prime transport forfaitaire
    const primeSalissure = 5000        // prime de salissure
    const totalPrimes = primeTransport + primeSalissure

    // Heures supplémentaires (taux horaire × 1.25 pour les 8 premières, ×1.5 au-delà)
    const hourlyRate = baseSalary / 173.33
    const ot1 = Math.min(overtimeHours, 8) * hourlyRate * 1.25
    const ot2 = Math.max(overtimeHours - 8, 0) * hourlyRate * 1.5
    const totalOvertime = Math.round(ot1 + ot2)

    const brut = salaireBrut + totalPrimes + totalOvertime

    // Cotisations sociales salariales
    const cnps_ipres_rg   = Math.round(brut * 0.056)  // IPRES Régime Général 5.6%
    const cnps_ipres_rc   = Math.round(Math.min(brut, 600000) * 0.036) // IPRES RC 3.6% plafonné
    const cotisationMaladie = Math.round(brut * 0.03)  // IPM 3%
    const totalCotisations = cnps_ipres_rg + cnps_ipres_rc + cotisationMaladie

    // IRPP/TRIMF simplifié (barème progressif simplifié Sénégal)
    const imposable = brut - totalCotisations
    let irpp = 0
    if (imposable > 630000) irpp = Math.round((imposable - 630000) * 0.40 + 97500)
    else if (imposable > 500000) irpp = Math.round((imposable - 500000) * 0.30 + 58500)
    else if (imposable > 350000) irpp = Math.round((imposable - 350000) * 0.25 + 21000)
    else if (imposable > 200000) irpp = Math.round((imposable - 200000) * 0.20 + 1000)
    else if (imposable > 50000) irpp = Math.round((imposable - 50000) * 0.05)
    const trimf = imposable <= 200000 ? 900 : imposable <= 500000 ? 3600 : 6000

    const totalRetenues = totalCotisations + irpp + trimf
    const net = brut - totalRetenues

    return {
      daysWorked, hoursWorked: (daysWorked * 8) + overtimeHours,
      baseSalary: baseSalary,
      grossSalary: brut, netSalary: Math.max(net, 0),
      bonuses: totalPrimes + totalOvertime,
      deductions: totalRetenues,
      notes: JSON.stringify({
        primeTransport, primeSalissure, heuresSupp: totalOvertime,
        cnps_ipres_rg, cnps_ipres_rc, cotisationMaladie,
        irpp, trimf, imposable,
      }),
    }
  }

  async generateMonthlyPayroll(month: number, year: number, agentIds?: string[]) {
    const existing = await this.prisma.payroll.findUnique({ where: { month_year: { month, year } } })
    if (existing) throw new BadRequestException('Paie déjà générée pour ce mois')

    const agents = await this.prisma.agent.findMany({
      where: { status: 'EN_POSTE', ...(agentIds && agentIds.length > 0 && { id: { in: agentIds } }) },
      select: { id: true, baseSalary: true },
    })

    // Période du mois
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 1)

    // Pour chaque agent, compter les jours travaillés depuis les pointages
    const linesData = await Promise.all(agents.map(async a => {
      const base = Number(a.baseSalary ?? 0)
      const pointages = await this.prisma.pointage.findMany({
        where: {
          agentId: a.id,
          date: { gte: monthStart, lt: monthEnd },
          status: { in: ['TERMINE', 'EN_COURS', 'PRESENT', 'RETARD', 'JUSTIFIE'] },
        },
        select: { date: true },
      })
      // Compter les jours uniques (un agent peut avoir 2 vacations/jour)
      const uniqueDays = new Set(pointages.map(p => p.date.toISOString().split('T')[0]))
      const daysWorked = uniqueDays.size

      return {
        agentId: a.id,
        daysWorked,
        hoursWorked: daysWorked * 8,
        baseSalary: base,
        bonuses: 0,
        deductions: 0,
        grossSalary: base,
        netSalary: base,
      }
    }))

    const totalBrut = linesData.reduce((s, l) => s + l.grossSalary, 0)
    const totalNet  = linesData.reduce((s, l) => s + l.netSalary, 0)

    return this.prisma.payroll.create({
      data: {
        month, year, status: 'BROUILLON', totalBrut, totalNet,
        lines: { create: linesData },
      },
      include: { lines: { include: { agent: { include: { user: { select: { firstName: true, lastName: true } } } } } } },
    })
  }

  async getPayslip(payrollLineId: string) {
    const line = await this.prisma.payrollLine.findUnique({
      where: { id: payrollLineId },
      include: {
        agent: { include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } } },
        payroll: true,
      },
    })
    if (!line) throw new NotFoundException('Fiche de paie introuvable')
    return {
      ...line,
      details: line.notes ? JSON.parse(line.notes) : null,
    }
  }

  async approvePayroll(payrollId: string, approvedBy: string) {
    return this.prisma.payroll.update({
      where: { id: payrollId },
      data: { status: 'VALIDE', approvedBy, processedAt: new Date() },
    })
  }

  async markPayrollPaid(payrollId: string) {
    return this.prisma.payroll.update({ where: { id: payrollId }, data: { status: 'PAYE' } })
  }

  async deletePayroll(payrollId: string) {
    const payroll = await this.prisma.payroll.findUnique({ where: { id: payrollId } })
    if (!payroll) throw new NotFoundException('Paie introuvable')
    if (payroll.status === 'PAYE') throw new BadRequestException('Impossible de supprimer une paie déjà payée')
    return this.prisma.payroll.delete({ where: { id: payrollId } })
  }

  // ── Détail d'une paie (toutes les lignes avec détails agents) ──
  async getPayrollDetail(payrollId: string) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id: payrollId },
      include: {
        lines: {
          include: {
            agent: {
              include: {
                user: { select: { firstName: true, lastName: true, phone: true, email: true } },
                deployments: { where: { isActive: true }, select: { site: { select: { name: true } } }, take: 1 },
              },
            },
          },
          orderBy: { agent: { user: { lastName: 'asc' } } },
        },
      },
    })
    if (!payroll) throw new NotFoundException('Paie introuvable')
    return payroll
  }

  // ── Modifier une ligne de paie (primes, retenues, jours, etc.) ──
  async updatePayrollLine(lineId: string, data: {
    daysWorked?: number
    baseSalary?: number
    bonuses?: number
    deductions?: number
    notes?: string
  }) {
    const line = await this.prisma.payrollLine.findUnique({ where: { id: lineId } })
    if (!line) throw new NotFoundException('Ligne de paie introuvable')

    const daysWorked = data.daysWorked ?? line.daysWorked
    const baseSalary = data.baseSalary ?? Number(line.baseSalary)
    const bonuses = data.bonuses ?? Number(line.bonuses)
    const deductions = data.deductions ?? Number(line.deductions)

    // Recalculer brut et net
    const dailyRate = baseSalary / 26
    const salaireBrutBase = Math.round(dailyRate * daysWorked)
    const brut = salaireBrutBase + bonuses
    const net = Math.max(brut - deductions, 0)

    const updated = await this.prisma.payrollLine.update({
      where: { id: lineId },
      data: {
        daysWorked,
        baseSalary,
        bonuses,
        deductions,
        grossSalary: brut,
        netSalary: net,
        hoursWorked: daysWorked * 8,
        notes: data.notes ?? line.notes,
      },
    })

    // Recalculer les totaux du payroll parent
    await this.recalcPayrollTotals(line.payrollId)

    return updated
  }

  // ── Bloquer / débloquer la paie d'un employé ──
  async toggleBlockPayrollLine(lineId: string, blocked: boolean, reason?: string) {
    const line = await this.prisma.payrollLine.findUnique({ where: { id: lineId } })
    if (!line) throw new NotFoundException('Ligne de paie introuvable')

    const updated = await this.prisma.payrollLine.update({
      where: { id: lineId },
      data: {
        blocked,
        blockReason: blocked ? (reason ?? 'Bloqué') : null,
        netSalary: blocked ? 0 : Math.max(Number(line.grossSalary) - Number(line.deductions), 0),
      },
    })

    await this.recalcPayrollTotals(line.payrollId)

    return updated
  }

  private async recalcPayrollTotals(payrollId: string) {
    const lines = await this.prisma.payrollLine.findMany({
      where: { payrollId },
      select: { grossSalary: true, netSalary: true },
    })
    const totalBrut = lines.reduce((s, l) => s + Number(l.grossSalary), 0)
    const totalNet = lines.reduce((s, l) => s + Number(l.netSalary), 0)
    await this.prisma.payroll.update({
      where: { id: payrollId },
      data: { totalBrut, totalNet },
    })
  }

  // ── Congés ──────────────────────────────────────────────────────
  async getLeaves(filters?: { agentId?: string; status?: string }) {
    return this.prisma.leave.findMany({
      where: {
        ...(filters?.agentId && { agentId: filters.agentId }),
        ...(filters?.status  && { status: filters.status as any }),
      },
      include: { agent: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { startDate: 'desc' },
    })
  }

  async requestLeave(agentId: string, data: { type: string; startDate: Date; endDate: Date; reason?: string }) {
    const days = Math.ceil((new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / 86_400_000) + 1
    return this.prisma.leave.create({
      data: { agentId, type: data.type as any, startDate: data.startDate, endDate: data.endDate, days, reason: data.reason, status: 'EN_ATTENTE' },
    })
  }

  async approveLeave(leaveId: string, approvedBy: string) {
    return this.prisma.leave.update({
      where: { id: leaveId },
      data: { status: 'APPROUVE', approvedBy, approvedAt: new Date() },
    })
  }

  async rejectLeave(leaveId: string) {
    return this.prisma.leave.update({ where: { id: leaveId }, data: { status: 'REFUSE' } })
  }

  // ── Formations ──────────────────────────────────────────────────────
  async getTrainings(agentId?: string) {
    return this.prisma.training.findMany({
      where: agentId ? { agentId } : undefined,
      include: { agent: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { startDate: 'desc' },
    })
  }

  async createTraining(data: { agentId: string; title: string; startDate: Date; endDate?: Date; trainer?: string; passed?: boolean; notes?: string }) {
    return this.prisma.training.create({ data })
  }

  // ── Disciplinaire ──────────────────────────────────────────────────────
  async getDisciplinary(agentId?: string) {
    return this.prisma.disciplinaryRecord.findMany({
      where: agentId ? { agentId } : undefined,
      include: { agent: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { date: 'desc' },
    })
  }

  async createDisciplinaryRecord(data: { agentId: string; type: string; description: string; date: Date; sanction?: string; recordedBy?: string }) {
    const faultCount = await this.prisma.disciplinaryRecord.count({ where: { agentId: data.agentId, type: 'FAUTE' as any } })
    const record = await this.prisma.disciplinaryRecord.create({
      data: {
        agentId: data.agentId,
        type: data.type as any,
        faultNumber: data.type === 'FAUTE' ? faultCount + 1 : 1,
        description: data.description,
        date: data.date,
        sanction: data.sanction,
        recordedBy: data.recordedBy,
      },
    })

    // Auto-update behavior rating based on fault count
    const totalFaults = data.type === 'FAUTE' ? faultCount + 1 : faultCount
    if (totalFaults >= 3) {
      await this.prisma.agent.update({
        where: { id: data.agentId },
        data: { behaviorRating: 'INDISCIPLINE' },
      })
    }

    return record
  }

  // ── Candidatures & Intégration ──────────────────────────────────────
  async getCandidacies(filters?: { status?: string }) {
    return this.prisma.candidacy.findMany({
      where: filters?.status ? { status: filters.status as any } : undefined,
      include: { integrationSteps: { orderBy: { createdAt: 'asc' } } },
      orderBy: { appliedAt: 'desc' },
    })
  }

  async createCandidacy(data: {
    firstName: string; lastName: string; phone: string; email?: string;
    cniNumber?: string; position: string; cvUrl?: string; photoUrl?: string; notes?: string;
  }) {
    const candidacy = await this.prisma.candidacy.create({ data: { ...data, status: 'CANDIDATURE' } })
    // Auto-create integration pipeline steps
    const steps = [
      { stepType: 'ENTRETIEN_EMBAUCHE' as any, title: "Entretien d'embauche", durationDays: 1 },
      { stepType: 'FORMATION_FCB' as any, title: 'Formation FCB', durationDays: 3 },
      { stepType: 'FORMATION_REGLEMENT' as any, title: 'Formation Règlement Intérieur', durationDays: 1 },
      { stepType: 'FORMATION_SERVICE_POSTE' as any, title: 'Formation Services et Poste', durationDays: 1 },
      { stepType: 'SIGNATURE_CONTRAT' as any, title: 'Signature de contrat de travail', durationDays: 1 },
      { stepType: 'MISE_EN_SERVICE' as any, title: 'Mise en service', durationDays: 1 },
    ]
    for (const step of steps) {
      await this.prisma.integrationStep.create({
        data: { candidacyId: candidacy.id, ...step },
      })
    }
    // Notify all RH users about the new candidacy
    this.notifyRhNewCandidacy(candidacy.id, data.firstName, data.lastName, data.position).catch(() => {})

    return this.prisma.candidacy.findUnique({
      where: { id: candidacy.id },
      include: { integrationSteps: { orderBy: { createdAt: 'asc' } } },
    })
  }

  private async notifyRhNewCandidacy(candidacyId: string, firstName: string, lastName: string, position: string) {
    const recipients = await this.prisma.user.findMany({
      where: { role: { in: ['RH', 'DG'] as any }, status: 'ACTIF' },
      select: { id: true },
    })
    for (const user of recipients) {
      await this.notifications.create({
        userId: user.id,
        type: 'RECRUTEMENT' as any,
        title: 'Nouveau postulant enregistré',
        message: `${firstName} ${lastName} a postulé pour le poste : ${position}`,
        data: { candidacyId },
      })
    }
  }

  async updateIntegrationStep(stepId: string, data: { completed?: boolean; passed?: boolean; startDate?: Date; endDate?: Date; trainer?: string; notes?: string }) {
    return this.prisma.integrationStep.update({ where: { id: stepId }, data })
  }

  // ── Conversion Candidat → Agent ─────────────────────────────────────
  async convertCandidacyToAgent(candidacyId: string, data: {
    email: string
    password: string
    role?: 'AGENT_TERRAIN' | 'CONTROLEUR' | 'TECHNICIENNE_SURFACE' | 'AGENT_ACCUEIL'
    position: string
    shift: 'JOUR' | 'NUIT' | 'MIXTE'
    contractType: 'CDD' | 'CDI' | 'ESSAI' | 'STAGE' | 'JOURNALIER'
    hireDate: string | Date
    contractEndDate?: string | Date
    baseSalary: number
    department?: string
    educationLevel?: string
    address?: string
    emergencyContact?: string
    emergencyPhone?: string
    emergencyRelation?: string
    bankAccount?: string
  }) {
    const candidacy = await this.prisma.candidacy.findUnique({
      where: { id: candidacyId },
      include: { integrationSteps: true },
    })
    if (!candidacy) throw new NotFoundException('Candidature introuvable')
    if (candidacy.agentId) throw new BadRequestException('Cette candidature a déjà été convertie en agent')

    const allStepsCompleted = candidacy.integrationSteps.every(s => s.completed && s.passed !== false)
    if (!allStepsCompleted) {
      throw new BadRequestException("Toutes les étapes d'intégration doivent être validées avant de créer l'agent")
    }

    if (!data.password || data.password.length < 6) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 6 caractères')
    }
    if (!data.email) throw new BadRequestException("L'email est obligatoire pour créer le compte utilisateur")

    // Vérifier unicité email & téléphone
    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ email: data.email }, { phone: candidacy.phone }] },
    })
    if (existingUser) {
      throw new BadRequestException(
        existingUser.email === data.email
          ? 'Cet email est déjà utilisé'
          : 'Ce numéro de téléphone est déjà utilisé'
      )
    }

    const passwordHash = await bcrypt.hash(data.password, 12)
    const count = await this.prisma.agent.count()
    const matricule = `AGT-${String(count + 1).padStart(4, '0')}`

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          phone: candidacy.phone,
          passwordHash,
          role: (data.role ?? 'AGENT_TERRAIN') as any,
          firstName: candidacy.firstName,
          lastName: candidacy.lastName,
          status: 'ACTIF',
          photoUrl: candidacy.photoUrl ?? undefined,
        },
      })

      const agent = await tx.agent.create({
        data: {
          userId: user.id,
          matricule,
          cniNumber: candidacy.cniNumber ?? undefined,
          position: data.position,
          shift: data.shift as any,
          status: 'DISPONIBLE' as any,
          hireDate: new Date(data.hireDate),
          contractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : undefined,
          contractType: data.contractType as any,
          baseSalary: data.baseSalary,
          department: data.department,
          educationLevel: data.educationLevel as any,
          address: data.address,
          emergencyContact: data.emergencyContact,
          emergencyPhone: data.emergencyPhone,
          emergencyRelation: data.emergencyRelation,
          bankAccount: data.bankAccount,
        },
      })

      await tx.candidacy.update({
        where: { id: candidacyId },
        data: { agentId: agent.id, status: 'EMBAUCHE' as any, processedBy: 'system' },
      })

      return { user, agent }
    })

    // Notifier le Chef Opérations qu'un nouvel agent est disponible
    this.notifyOpsNewAgent(result.agent.id, candidacy.firstName, candidacy.lastName, matricule).catch(() => {})

    return result
  }

  private async notifyOpsNewAgent(agentId: string, firstName: string, lastName: string, matricule: string) {
    const opsUsers = await this.prisma.user.findMany({
      where: { role: { in: ['CHEF_OPERATIONS', 'DIRECTEUR_GENERAL'] as any }, status: 'ACTIF' },
      select: { id: true },
    })
    for (const u of opsUsers) {
      await this.notifications.create({
        userId: u.id,
        type: 'ASSIGNATION' as any,
        title: 'Nouvel agent disponible',
        message: `${firstName} ${lastName} (${matricule}) est prêt à être déployé sur un site.`,
        data: { agentId },
      })
    }
  }

  // ── Contrats de travail ──────────────────────────────────────────────
  async getContracts(filters?: { status?: string; contractType?: string }) {
    return this.prisma.agent.findMany({
      where: {
        ...(filters?.status && { status: filters.status as any }),
        ...(filters?.contractType && { contractType: filters.contractType as any }),
      },
      select: {
        id: true, matricule: true, status: true, position: true,
        contractType: true, hireDate: true, contractEndDate: true,
        baseSalary: true, shift: true, department: true,
        user: { select: { firstName: true, lastName: true, phone: true, email: true } },
        deployments: {
          where: { isActive: true },
          select: { site: { select: { name: true } } },
          take: 1,
        },
      },
      orderBy: { hireDate: 'desc' },
    })
  }

  // ── Alertes RH ──────────────────────────────────────────────────────
  async getContractExpiryAlerts(daysAhead = 30) {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + daysAhead)
    return this.prisma.agent.findMany({
      where: {
        contractEndDate: { lte: futureDate, gte: new Date() },
        status: 'EN_POSTE',
      },
      include: { user: { select: { firstName: true, lastName: true, phone: true, email: true } } },
      orderBy: { contractEndDate: 'asc' },
    })
  }

  async getIndisciplinedAgents() {
    return this.prisma.agent.findMany({
      where: { behaviorRating: 'INDISCIPLINE' },
      include: {
        user: { select: { firstName: true, lastName: true, phone: true } },
        disciplinary: { orderBy: { date: 'desc' } },
      },
    })
  }

  // ── Stats RH ──────────────────────────────────────────────────────
  async getHrStats() {
    const now = new Date()
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)

    const [totalAgents, onDuty, onLeave, pendingLeaves, contractsExpiring, indisciplined] = await Promise.all([
      this.prisma.agent.count(),
      this.prisma.agent.count({ where: { status: 'EN_POSTE' } }),
      this.prisma.leave.count({ where: { status: 'APPROUVE', startDate: { lte: now }, endDate: { gte: now } } }),
      this.prisma.leave.count({ where: { status: 'EN_ATTENTE' } }),
      this.prisma.agent.count({ where: { contractEndDate: { lte: futureDate, gte: now }, status: 'EN_POSTE' } }),
      this.prisma.agent.count({ where: { behaviorRating: 'INDISCIPLINE' } }),
    ])
    return { totalAgents, onDuty, onLeave, pendingLeaves, absent: totalAgents - onDuty - onLeave, contractsExpiring, indisciplined }
  }
}
