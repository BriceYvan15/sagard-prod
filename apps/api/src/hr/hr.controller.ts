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

  @Post('payrolls/generate')
  @ApiOperation({ summary: 'Générer la paie mensuelle' })
  generatePayroll(@Body() body: { month: number; year: number }) {
    return this.hrService.generateMonthlyPayroll(body.month, body.year)
  }

  @Get('payslip/:id')
  @ApiOperation({ summary: 'Fiche de paie individuelle détaillée' })
  getPayslip(@Param('id') id: string) { return this.hrService.getPayslip(id) }

  @Patch('payrolls/:id/approve')
  approvePayroll(@Param('id') id: string, @Request() req: any) {
    return this.hrService.approvePayroll(id, req.user.id)
  }

  @Patch('payrolls/:id/pay')
  markPaid(@Param('id') id: string) { return this.hrService.markPayrollPaid(id) }

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
}
