import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Role } from '@prisma/client'
import { TrainingsService } from './trainings.service'

@ApiTags('Formations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('trainings')
export class TrainingsController {
  constructor(private trainingsService: TrainingsService) {}

  // ── ERP: Session management ─────────────────────────────────────

  @Post('sessions')
  @Roles(Role.DIRECTEUR_GENERAL, Role.RH, Role.CHEF_OPERATIONS)
  @ApiOperation({ summary: 'Créer une session de formation' })
  createSession(@Body() body: any, @Request() req: any) {
    return this.trainingsService.createSession({ ...body, createdById: req.user.id })
  }

  @Get('sessions')
  @Roles(Role.DIRECTEUR_GENERAL, Role.RH, Role.CHEF_OPERATIONS)
  @ApiOperation({ summary: 'Liste des sessions de formation' })
  findAllSessions(@Query('status') status?: string, @Query('type') type?: string) {
    return this.trainingsService.findAllSessions({ status, type })
  }

  @Get('sessions/:id')
  @Roles(Role.DIRECTEUR_GENERAL, Role.RH, Role.CHEF_OPERATIONS)
  @ApiOperation({ summary: 'Détail d\'une session avec participants et questions' })
  findOneSession(@Param('id') id: string) {
    return this.trainingsService.findOneSession(id)
  }

  @Patch('sessions/:id')
  @Roles(Role.DIRECTEUR_GENERAL, Role.RH, Role.CHEF_OPERATIONS)
  @ApiOperation({ summary: 'Modifier une session (brouillon uniquement)' })
  updateSession(@Param('id') id: string, @Body() body: any) {
    return this.trainingsService.updateSession(id, body)
  }

  @Delete('sessions/:id')
  @Roles(Role.DIRECTEUR_GENERAL, Role.RH)
  @ApiOperation({ summary: 'Supprimer une session (brouillon uniquement)' })
  deleteSession(@Param('id') id: string) {
    return this.trainingsService.deleteSession(id)
  }

  @Post('sessions/:id/publish')
  @Roles(Role.DIRECTEUR_GENERAL, Role.RH)
  @ApiOperation({ summary: 'Publier une session et notifier les agents' })
  publishSession(@Param('id') id: string) {
    return this.trainingsService.publishSession(id)
  }

  // ── ERP: Questions ──────────────────────────────────────────────

  @Post('sessions/:id/questions')
  @Roles(Role.DIRECTEUR_GENERAL, Role.RH, Role.CHEF_OPERATIONS)
  @ApiOperation({ summary: 'Ajouter une question à un QCM' })
  addQuestion(@Param('id') sessionId: string, @Body() body: any) {
    return this.trainingsService.addQuestion(sessionId, body)
  }

  @Delete('sessions/:id/questions/:questionId')
  @Roles(Role.DIRECTEUR_GENERAL, Role.RH, Role.CHEF_OPERATIONS)
  @ApiOperation({ summary: 'Supprimer une question' })
  deleteQuestion(@Param('id') sessionId: string, @Param('questionId') questionId: string) {
    return this.trainingsService.deleteQuestion(sessionId, questionId)
  }

  // ── ERP: Participants ───────────────────────────────────────────

  @Post('sessions/:id/participants')
  @Roles(Role.DIRECTEUR_GENERAL, Role.RH, Role.CHEF_OPERATIONS)
  @ApiOperation({ summary: 'Assigner des agents à une session' })
  assignParticipants(@Param('id') sessionId: string, @Body() body: { agentIds: string[] }) {
    return this.trainingsService.assignParticipants(sessionId, body.agentIds)
  }

  @Patch('participants/:id')
  @Roles(Role.DIRECTEUR_GENERAL, Role.RH)
  @ApiOperation({ summary: 'Modifier le statut d\'un participant (validation pratique)' })
  updateParticipant(@Param('id') id: string, @Body() body: any) {
    return this.trainingsService.updateParticipant(id, body)
  }

  // ── Mobile: Agent side ───────────────────────────────────────────

  @Get('my-trainings')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Mes formations assignées (agent)' })
  getMyTrainings(@Request() req: any) {
    return this.trainingsService.getMyTrainings(req.user.id)
  }

  @Get('my-trainings/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Détail d\'une formation (agent)' })
  getTrainingDetail(@Request() req: any, @Param('id') id: string) {
    return this.trainingsService.getTrainingDetail(req.user.id, id)
  }

  @Post('my-trainings/:id/submit')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Soumettre une formation (QCM / lecture / vidéo)' })
  submitTraining(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.trainingsService.submitTraining(req.user.id, id, body)
  }
}
