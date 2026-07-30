import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { HrService } from './hr.service'

@ApiTags('RH')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('hr')
export class HrController {
  constructor(private hrService: HrService) {}

  @Get('stats')
  getStats() { return this.hrService.getHrStats() }

  // ── Paie ──
  @Get('payrolls')
  getPayrolls(@Query('month') month?: string, @Query('year') year?: string) {
    return this.hrService.getPayrolls({ month: month ? +month : undefined, year: year ? +year : undefined })
  }

  @Post('payrolls/create-month')
  @ApiOperation({ summary: 'Créer un mois de paie avec calcul auto depuis les pointages' })
  createPayrollMonth(@Body() body: { month: number; year: number }) {
    return this.hrService.createPayrollMonth(body.month, body.year)
  }

  @Get('payslip/:id')
  @ApiOperation({ summary: 'Fiche de paie individuelle détaillée' })
  getPayslip(@Param('id') id: string) { return this.hrService.getPayslip(id) }

  @Get('agents/:agentId/work-stats')
  @ApiOperation({ summary: 'Statistiques de travail d\'un agent (heures réelles vs attendues)' })
  getWorkStats(
    @Param('agentId') agentId: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.hrService.getWorkStats(agentId, month ? +month : undefined, year ? +year : undefined)
  }

  @Patch('payroll-lines/:id/validate')
  @ApiOperation({ summary: 'Valider une ligne de paie (BROUILLON → VALIDE)' })
  validateLine(@Param('id') id: string) { return this.hrService.validatePayrollLine(id) }

  @Patch('payroll-lines/:id/pay')
  @ApiOperation({ summary: 'Payer une ligne de paie avec débit trésorerie' })
  payLine(@Param('id') id: string, @Body() body: { treasuryAccountId: string; paymentMethod?: string; reference?: string }) {
    return this.hrService.payPayrollLine(id, body)
  }

  @Post('payrolls/:id/delete')
  @ApiOperation({ summary: 'Supprimer une fiche de paie (non payée)' })
  deletePayroll(@Param('id') id: string) { return this.hrService.deletePayroll(id) }

  @Get('payrolls/:id/detail')
  @ApiOperation({ summary: 'Détail d\'une paie avec toutes les lignes' })
  getPayrollDetail(@Param('id') id: string) { return this.hrService.getPayrollDetail(id) }

  @Patch('payroll-lines/:id')
  @ApiOperation({ summary: 'Modifier une ligne de paie (primes, retenues, jours)' })
  updatePayrollLine(@Param('id') id: string, @Body() body: any) {
    return this.hrService.updatePayrollLine(id, body)
  }

  @Patch('payroll-lines/:id/block')
  @ApiOperation({ summary: 'Bloquer / débloquer la paie d\'un employé' })
  toggleBlockPayrollLine(@Param('id') id: string, @Body() body: { blocked: boolean; reason?: string }) {
    return this.hrService.toggleBlockPayrollLine(id, body.blocked, body.reason)
  }

  // ── Congés ──
  @Get('leaves')
  getLeaves(@Query('agentId') agentId?: string, @Query('status') status?: string) {
    return this.hrService.getLeaves({ agentId, status })
  }

  @Post('leaves')
  @ApiOperation({ summary: 'Créer une demande de congé' })
  requestLeave(@Body() body: any) { return this.hrService.requestLeave(body.agentId, body) }

  @Patch('leaves/:id/approve')
  approveLeave(@Param('id') id: string, @Request() req: any) {
    return this.hrService.approveLeave(id, req.user.id)
  }

  @Patch('leaves/:id/reject')
  rejectLeave(@Param('id') id: string) { return this.hrService.rejectLeave(id) }

  // ── Formations ──
  @Get('trainings')
  getTrainings(@Query('agentId') agentId?: string) { return this.hrService.getTrainings(agentId) }

  @Post('trainings')
  createTraining(@Body() body: any) { return this.hrService.createTraining(body) }

  // ── Disciplinaire ──
  @Get('disciplinary')
  getDisciplinary(@Query('agentId') agentId?: string) { return this.hrService.getDisciplinary(agentId) }

  @Post('disciplinary')
  createDisciplinary(@Body() body: any) { return this.hrService.createDisciplinaryRecord(body) }

  // ── Candidatures & Intégration ──
  @Get('candidacies')
  @ApiOperation({ summary: 'Liste des candidatures' })
  getCandidacies(@Query('status') status?: string) { return this.hrService.getCandidacies({ status }) }

  @Post('candidacies')
  @ApiOperation({ summary: 'Créer une candidature (avec pipeline intégration auto)' })
  createCandidacy(@Body() body: any) { return this.hrService.createCandidacy(body) }

  @Patch('integration-steps/:id')
  @ApiOperation({ summary: 'Mettre à jour une étape d\'intégration' })
  updateIntegrationStep(@Param('id') id: string, @Body() body: any) {
    return this.hrService.updateIntegrationStep(id, body)
  }

  @Post('candidacies/:id/convert-to-agent')
  @ApiOperation({ summary: 'Convertir une candidature validée en agent (création User + Agent)' })
  convertCandidacyToAgent(@Param('id') id: string, @Body() body: any) {
    return this.hrService.convertCandidacyToAgent(id, body)
  }

  // ── Contrats de travail ──
  @Get('contracts')
  @ApiOperation({ summary: 'Liste des contrats de travail des agents' })
  getContracts(@Query('status') status?: string, @Query('contractType') contractType?: string) {
    return this.hrService.getContracts({ status, contractType })
  }

  // ── Alertes RH ──
  @Get('alerts/contract-expiry')
  @ApiOperation({ summary: 'Contrats de travail expirant dans 30 jours' })
  getContractExpiryAlerts(@Query('days') days?: string) {
    return this.hrService.getContractExpiryAlerts(days ? +days : 30)
  }

  @Get('alerts/indisciplined')
  @ApiOperation({ summary: 'Agents indisciplinés (3+ fautes)' })
  getIndisciplinedAgents() { return this.hrService.getIndisciplinedAgents() }

  // ── Services Extra (assignés par le chef des opérations) ──
  @Post('agents/:agentId/extra-services')
  @ApiOperation({ summary: 'Assigner un service extra à un agent (chef des opérations)' })
  assignExtraService(
    @Param('agentId') agentId: string,
    @Body() body: { date: string; hours?: number; amount?: number; description?: string; assignedById?: string; assignedByName?: string },
  ) {
    return this.hrService.assignExtraService(agentId, body)
  }

  @Get('agents/:agentId/extra-services')
  @ApiOperation({ summary: 'Liste des services extra d\'un agent' })
  getExtraServices(@Param('agentId') agentId: string, @Query('month') month?: string, @Query('year') year?: string) {
    return this.hrService.getExtraServices(agentId, month ? +month : undefined, year ? +year : undefined)
  }

  @Patch('extra-services/:id/validate')
  @ApiOperation({ summary: 'Valider un service extra' })
  validateExtraService(@Param('id') id: string) {
    return this.hrService.validateExtraService(id)
  }

  @Patch('extra-services/:id/cancel')
  @ApiOperation({ summary: 'Annuler un service extra' })
  cancelExtraService(@Param('id') id: string) {
    return this.hrService.cancelExtraService(id)
  }
}
