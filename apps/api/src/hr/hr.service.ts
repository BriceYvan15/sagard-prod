import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'
import { TreasuryService } from '../treasury/treasury.service'

@Injectable()
export class HrService {
  constructor(private prisma: PrismaService, private notifications: NotificationsService, private treasury: TreasuryService) {}

  // ── Paie (Payroll = document mensuel global + PayrollLine par agent) ──
  async getPayrolls(filters?: { month?: number; year?: number }) {
    const payrolls = await this.prisma.payroll.findMany({
      where: {
        ...(filters?.month && { month: filters.month }),
        ...(filters?.year  && { year:  filters.year  }),
      },
      include: { lines: { include: { agent: { include: { user: { select: { firstName: true, lastName: true } } } } } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    })
    // Enrichir avec le compte de payés/lignes
    return payrolls.map(p => {
      const paidCount = p.lines.filter(l => l.paymentStatus === 'PAYE').length
      const validatedCount = p.lines.filter(l => l.paymentStatus === 'VALIDE').length
      const blockedCount = p.lines.filter(l => l.blocked).length
      return { ...p, paidCount, validatedCount, blockedCount, totalLines: p.lines.length }
    })
  }

  // Taux fixe par vacation de 12h (JOUR ou NUIT)
  private static readonly VACATION_RATE = 2500

  // ── Créer un mois de paie : crée le Payroll + une ligne par agent EN_POSTE avec vacations calculées depuis pointages ──
  async createPayrollMonth(month: number, year: number) {
    const existing = await this.prisma.payroll.findUnique({ where: { month_year: { month, year } } })
    if (existing) throw new BadRequestException('La paie de ce mois existe déjà')

    const agents = await this.prisma.agent.findMany({
      where: { status: 'EN_POSTE' },
      select: { id: true, baseSalary: true },
    })

    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 1)

    const linesData = await Promise.all(agents.map(async a => {
      const base = Number(a.baseSalary ?? 0)
      // Chaque pointage TERMINÉ = 1 vacation de 12h (JOUR ou NUIT)
      // Un agent qui fait JOUR + NUIT le même jour = 2 vacations = 24h = 5000 FCFA
      const pointages = await this.prisma.pointage.findMany({
        where: {
          agentId: a.id,
          date: { gte: monthStart, lt: monthEnd },
          status: 'TERMINE',
        },
        select: { hoursWorked: true },
      })
      const daysWorked = pointages.length
      const hoursWorked = pointages.reduce((sum, p) => sum + (p.hoursWorked ?? 0), 0)
      const salaireBrut = daysWorked * HrService.VACATION_RATE

      return {
        agentId: a.id,
        daysWorked,
        hoursWorked: Math.round(hoursWorked * 100) / 100,
        baseSalary: base,
        bonuses: 0,
        deductions: 0,
        grossSalary: salaireBrut,
        netSalary: salaireBrut,
        paymentStatus: 'BROUILLON' as any,
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

  // ── Fiche de paie détaillée (avec calcul des cotisations) ──
  async getPayslip(lineId: string) {
    const line = await this.prisma.payrollLine.findUnique({
      where: { id: lineId },
      include: {
        agent: { include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } } },
        payroll: true,
      },
    })
    if (!line) throw new NotFoundException('Fiche de paie introuvable')

    const brut = Number(line.grossSalary)
    const cnps_ipres_rg = Math.round(brut * 0.056)
    const cnps_ipres_rc = Math.round(Math.min(brut, 600000) * 0.036)
    const cotisationMaladie = Math.round(brut * 0.03)
    const totalCotisations = cnps_ipres_rg + cnps_ipres_rc + cotisationMaladie
    const imposable = brut - totalCotisations
    let irpp = 0
    if (imposable > 630000) irpp = Math.round((imposable - 630000) * 0.40 + 97500)
    else if (imposable > 500000) irpp = Math.round((imposable - 500000) * 0.30 + 58500)
    else if (imposable > 350000) irpp = Math.round((imposable - 350000) * 0.25 + 21000)
    else if (imposable > 200000) irpp = Math.round((imposable - 200000) * 0.20 + 1000)
    else if (imposable > 50000) irpp = Math.round((imposable - 50000) * 0.05)
    const trimf = imposable <= 200000 ? 900 : imposable <= 500000 ? 3600 : 6000

    return {
      ...line,
      details: { cnps_ipres_rg, cnps_ipres_rc, cotisationMaladie, irpp, trimf, imposable, primeTransport: 0, primeSalissure: 0, heuresSupp: 0 },
    }
  }

  // ── Statistiques de travail d'un agent (heures réelles vs attendues + financier) ──
  // Règles métier :
  //   - 1 vacation = 12h (JOUR/NUIT) ou 24h (MIXTE) = 2500 FCFA
  //   - Retard : 200 FCFA de pénalité par heure de retard
  //   - Heures manquées : déduction proportionnelle (1 jour non travaillé = -2500 F)
  //   - Rattrapage : possible pour les heures manquées (à valider par le chef)
  //   - Services extra : assignés par le chef des opérations, rémunérés à 2500 F/vacation
  async getWorkStats(agentId: string, month?: number, year?: number) {
    const today = new Date()
    const m = month ?? today.getMonth() + 1
    const y = year ?? today.getFullYear()

    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { id: true, shift: true, baseSalary: true, status: true },
    })
    if (!agent) throw new NotFoundException('Agent introuvable')

    const hoursPerDay = agent.shift === 'MIXTE' ? 24 : 12
    const vacationRate = HrService.VACATION_RATE
    const latePenaltyPerHour = 200

    const monthStart = new Date(y, m - 1, 1)
    const monthEnd = new Date(y, m, 1)
    const daysInMonth = new Date(y, m, 0).getDate()

    const expectedDays = agent.shift === 'MIXTE' ? Math.ceil(daysInMonth / 2) : daysInMonth
    const expectedHours = expectedDays * hoursPerDay

    const pointages = await this.prisma.pointage.findMany({
      where: { agentId, date: { gte: monthStart, lt: monthEnd } },
      select: { id: true, date: true, shift: true, checkInTime: true, checkOutTime: true, hoursWorked: true, overtimeHours: true, lateMinutes: true, status: true },
      orderBy: { date: 'desc' },
    })

    // Services extra du mois
    const extraServices = await this.prisma.extraService.findMany({
      where: { agentId, date: { gte: monthStart, lt: monthEnd } },
      orderBy: { date: 'desc' },
    }).catch(() => [] as Awaited<ReturnType<typeof this.prisma.extraService.findMany>>)

    const completed = pointages.filter(p => p.status === 'TERMINE')
    const inProgress = pointages.filter(p => p.status === 'EN_COURS' || p.status === 'RETARD')
    const absent = pointages.filter(p => p.status === 'ABSENT')

    const daysWorked = completed.length
    const totalHoursCompleted = completed.reduce((sum, p) => sum + (p.hoursWorked ?? 0), 0)
    const totalMinutes = Math.round(totalHoursCompleted * 60)
    const overtimeHours = completed.reduce((sum, p) => sum + (p.overtimeHours ?? 0), 0)
    const lateCount = completed.filter(p => (p.lateMinutes ?? 0) > 0).length
    const totalLateMinutes = completed.reduce((sum, p) => sum + (p.lateMinutes ?? 0), 0)
    const lateHours = Math.round((totalLateMinutes / 60) * 100) / 100

    // ── Calculs financiers ──
    // 1) Gains complets : 2500 F par vacation terminée
    const completedEarnings = daysWorked * vacationRate

    // 2) Gains partiels : pour les services en cours, on calcule au prorata
    //    Taux horaire = 2500 / heuresParJour (ex: 2500/12 ≈ 208 F/h)
    //    Pas de décimales en FCFA → Math.round
    const hourlyRate = vacationRate / hoursPerDay
    const partialEarningsDetails = inProgress.map(p => {
      const checkIn = p.checkInTime ? new Date(p.checkInTime) : null
      const elapsedHours = checkIn ? Math.min(hoursPerDay, (today.getTime() - checkIn.getTime()) / 3600000) : 0
      const earned = Math.round(elapsedHours * hourlyRate)
      return { pointageId: p.id, elapsedHours: Math.round(elapsedHours * 100) / 100, earned }
    })
    const partialEarnings = partialEarningsDetails.reduce((sum, e) => sum + e.earned, 0)
    const partialHours = partialEarningsDetails.reduce((sum, e) => sum + e.elapsedHours, 0)

    const grossEarnings = completedEarnings + partialEarnings
    const lateDeduction = Math.ceil(lateHours) * latePenaltyPerHour
    // Les jours en cours ne sont pas comptés comme manqués
    const missingDays = Math.max(0, expectedDays - daysWorked - inProgress.length)
    const totalHoursAll = totalHoursCompleted + partialHours
    const missingHours = Math.max(0, Math.round((expectedHours - totalHoursAll) * 100) / 100)
    const missingDaysDeduction = missingDays * vacationRate
    const totalDeductions = lateDeduction + missingDaysDeduction

    // Services extra
    const extraServicesCount = extraServices.length
    const extraServicesHours = extraServices.reduce((sum, e: any) => sum + (e.hours ?? 0), 0)
    const extraServicesEarnings = Math.round(extraServices.reduce((sum, e: any) => sum + Number(e.amount ?? vacationRate), 0))

    // Net estimé (arrondi sans décimales)
    const netEarnings = Math.round(grossEarnings - lateDeduction + extraServicesEarnings)

    // Rattrapage
    const rattrapageEligible = missingHours > 0
    const rattrapageHoursNeeded = missingHours

    const attendanceRate = expectedDays > 0 ? Math.round((daysWorked / expectedDays) * 100) : 0
    const fillRate = expectedHours > 0 ? Math.round((totalHoursAll / expectedHours) * 100) : 0

    return {
      agentId,
      month: m,
      year: y,
      shift: agent.shift,
      hoursPerDay,
      vacationRate,
      daysInMonth,
      expectedDays,
      expectedHours,
      daysWorked,
      hoursWorked: Math.round(totalHoursAll * 100) / 100,
      minutesWorked: totalMinutes,
      overtimeHours: Math.round(overtimeHours * 100) / 100,
      lateCount,
      totalLateMinutes,
      lateHours,
      latePenaltyPerHour,
      lateDeduction,
      missingDays,
      missingHours,
      missingDaysDeduction,
      totalDeductions,
      completedEarnings,
      partialEarnings,
      partialEarningsDetails,
      grossEarnings,
      netEarnings,
      inProgressCount: inProgress.length,
      absentCount: absent.length,
      attendanceRate,
      fillRate,
      rattrapageEligible,
      rattrapageHoursNeeded,
      extraServices: extraServices.map((e: any) => ({
        id: e.id,
        date: e.date,
        hours: e.hours,
        description: e.description,
        amount: e.amount,
        status: e.status,
        assignedByName: e.assignedByName,
      })),
      extraServicesCount,
      extraServicesHours,
      extraServicesEarnings,
      recentPointages: pointages.slice(0, 10),
    }
  }

  // ── Valider une ligne de paie (BROUILLON → VALIDE) ──
  async validatePayrollLine(lineId: string) {
    const line = await this.prisma.payrollLine.findUnique({ where: { id: lineId } })
    if (!line) throw new NotFoundException('Ligne de paie introuvable')
    if (line.blocked) throw new BadRequestException('Cette ligne est bloquée')
    if (line.paymentStatus === 'PAYE') throw new BadRequestException('Cette ligne est déjà payée')

    return this.prisma.payrollLine.update({
      where: { id: lineId },
      data: { paymentStatus: 'VALIDE' },
    })
  }

  // ── Payer une ligne de paie (VALIDE → PAYE) avec débit trésorerie ──
  async payPayrollLine(lineId: string, data: { treasuryAccountId: string; paymentMethod?: string; reference?: string }) {
    const line = await this.prisma.payrollLine.findUnique({
      where: { id: lineId },
      include: { agent: { include: { user: { select: { firstName: true, lastName: true } } } }, payroll: true },
    })
    if (!line) throw new NotFoundException('Ligne de paie introuvable')
    if (line.blocked) throw new BadRequestException('Cette ligne est bloquée')
    if (line.paymentStatus === 'PAYE') throw new BadRequestException('Cette ligne est déjà payée')
    if (line.paymentStatus !== 'VALIDE') throw new BadRequestException('La ligne doit être validée avant paiement')

    const amount = Number(line.netSalary)
    if (amount <= 0) throw new BadRequestException('Le montant net est nul ou négatif')

    // Débiter la trésorerie
    await this.treasury.debit(data.treasuryAccountId, {
      amount,
      description: `Salaire - ${line.agent.user.firstName} ${line.agent.user.lastName} - ${String(line.payroll.month).padStart(2, '0')}/${line.payroll.year}`,
      reference: data.reference,
    })

    return this.prisma.payrollLine.update({
      where: { id: lineId },
      data: {
        paymentStatus: 'PAYE',
        paidAt: new Date(),
        paymentMethod: data.paymentMethod || 'VIREMENT_BANCAIRE',
        paymentReference: data.reference,
        treasuryAccountId: data.treasuryAccountId,
      },
    })
  }

  // ── Supprimer un mois de paie (si aucune ligne n'est PAYE) ──
  async deletePayroll(payrollId: string) {
    const payroll = await this.prisma.payroll.findUnique({
      where: { id: payrollId },
      include: { lines: { select: { paymentStatus: true } } },
    })
    if (!payroll) throw new NotFoundException('Paie introuvable')
    const hasPaid = payroll.lines.some(l => l.paymentStatus === 'PAYE')
    if (hasPaid) throw new BadRequestException('Impossible de supprimer : certaines lignes sont déjà payées')

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
    if (line.paymentStatus === 'PAYE') throw new BadRequestException('Cette ligne est déjà payée')

    const daysWorked = data.daysWorked ?? line.daysWorked
    const baseSalary = data.baseSalary ?? Number(line.baseSalary)
    const bonuses = data.bonuses ?? Number(line.bonuses)
    const deductions = data.deductions ?? Number(line.deductions)

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

    await this.recalcPayrollTotals(line.payrollId)
    return updated
  }

  // ── Bloquer / débloquer la paie d'un employé ──
  async toggleBlockPayrollLine(lineId: string, blocked: boolean, reason?: string) {
    const line = await this.prisma.payrollLine.findUnique({ where: { id: lineId } })
    if (!line) throw new NotFoundException('Ligne de paie introuvable')
    if (line.paymentStatus === 'PAYE') throw new BadRequestException('Cette ligne est déjà payée')

    const updateData: any = { blocked }
    if (blocked) {
      updateData.blockReason = reason ?? 'Bloqué'
      updateData.paymentStatus = 'BLOQUE'
      updateData.netSalary = 0
    } else {
      updateData.blockReason = null
      updateData.paymentStatus = 'BROUILLON'
      updateData.netSalary = Math.max(Number(line.grossSalary) - Number(line.deductions), 0)
    }

    const updated = await this.prisma.payrollLine.update({ where: { id: lineId }, data: updateData })
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

  // ── Services Extra (assignés par le chef des opérations) ──
  async assignExtraService(agentId: string, data: { date: string; hours?: number; amount?: number; description?: string; assignedById?: string; assignedByName?: string }) {
    const agent = await this.prisma.agent.findUnique({ where: { id: agentId } })
    if (!agent) throw new NotFoundException('Agent introuvable')

    return this.prisma.extraService.create({
      data: {
        agentId,
        date: new Date(data.date),
        hours: data.hours ?? 12,
        amount: data.amount ?? HrService.VACATION_RATE,
        description: data.description,
        assignedById: data.assignedById,
        assignedByName: data.assignedByName,
        status: 'EN_ATTENTE',
      },
    })
  }

  async getExtraServices(agentId: string, month?: number, year?: number) {
    const now = new Date()
    const m = month ?? now.getMonth() + 1
    const y = year ?? now.getFullYear()
    const monthStart = new Date(y, m - 1, 1)
    const monthEnd = new Date(y, m, 1)

    return this.prisma.extraService.findMany({
      where: { agentId, date: { gte: monthStart, lt: monthEnd } },
      orderBy: { date: 'desc' },
    })
  }

  async validateExtraService(id: string) {
    const svc = await this.prisma.extraService.findUnique({ where: { id } })
    if (!svc) throw new NotFoundException('Service extra introuvable')
    return this.prisma.extraService.update({
      where: { id },
      data: { status: 'VALIDEE' },
    })
  }

  async cancelExtraService(id: string) {
    const svc = await this.prisma.extraService.findUnique({ where: { id } })
    if (!svc) throw new NotFoundException('Service extra introuvable')
    return this.prisma.extraService.update({
      where: { id },
      data: { status: 'ANNULEE' },
    })
  }
}
