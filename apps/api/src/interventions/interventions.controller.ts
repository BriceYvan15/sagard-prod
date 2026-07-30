import { Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Role } from '@prisma/client'
import { InterventionsService } from './interventions.service'

@ApiTags('Interventions Techniques')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.DIRECTEUR_GENERAL, Role.CHEF_OPERATIONS, Role.TECHNICIEN)
@Controller('interventions')
export class InterventionsController {
  constructor(private interventionsService: InterventionsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des interventions' })
  findAll(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('technicianId') technicianId?: string,
    @Query('type') type?: string,
  ) {
    return this.interventionsService.findAll({ status, technicianId, type }, req.user)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail d\'une intervention' })
  findOne(@Param('id') id: string) {
    return this.interventionsService.findOne(id)
  }

  @Post()
  @ApiOperation({ summary: 'Créer une intervention (DG/CHEF_OPS)' })
  @Roles(Role.DIRECTEUR_GENERAL, Role.CHEF_OPERATIONS)
  create(@Request() req: any, @Body() body: any) {
    return this.interventionsService.create(body, req.user?.sub ?? req.user?.id)
  }

  @Post(':id/assign')
  @ApiOperation({ summary: 'Assigner un technicien (DG/CHEF_OPS)' })
  @Roles(Role.DIRECTEUR_GENERAL, Role.CHEF_OPERATIONS)
  assignTechnician(@Param('id') id: string, @Body() body: { technicianId: string }) {
    return this.interventionsService.assignTechnician(id, body.technicianId)
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Démarrer l\'intervention (technicien)' })
  @Roles(Role.TECHNICIEN)
  start(@Param('id') id: string, @Request() req: any) {
    return this.interventionsService.startIntervention(id, req.user.sub ?? req.user.id)
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Terminer l\'intervention (technicien)' })
  @Roles(Role.TECHNICIEN)
  complete(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { report?: string; afterPhotos?: string[] },
  ) {
    return this.interventionsService.completeIntervention(id, req.user.sub ?? req.user.id, body)
  }

  @Post(':id/before-photos')
  @ApiOperation({ summary: 'Ajouter photos avant intervention (technicien)' })
  @Roles(Role.TECHNICIEN)
  addBeforePhotos(@Param('id') id: string, @Body() body: { photos: string[] }) {
    return this.interventionsService.addBeforePhotos(id, body.photos)
  }

  @Post(':id/reschedule')
  @ApiOperation({ summary: 'Reporter l\'intervention (DG/CHEF_OPS)' })
  @Roles(Role.DIRECTEUR_GENERAL, Role.CHEF_OPERATIONS)
  reschedule(@Param('id') id: string, @Body() body: { newDate: string }) {
    return this.interventionsService.reschedule(id, body.newDate)
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Annuler l\'intervention (DG/CHEF_OPS)' })
  @Roles(Role.DIRECTEUR_GENERAL, Role.CHEF_OPERATIONS)
  cancel(@Param('id') id: string) {
    return this.interventionsService.cancel(id)
  }
}
