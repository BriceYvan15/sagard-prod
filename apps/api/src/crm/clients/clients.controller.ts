import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request, Res } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../../auth/guards/roles.guard'
import { Roles } from '../../auth/decorators/roles.decorator'
import { ClientsService } from './clients.service'
import { AuditService } from '../../audit/audit.service'

@ApiTags('CRM — Clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('clients')
export class ClientsController {
  constructor(private clientsService: ClientsService, private audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des clients' })
  findAll(@Request() req: any, @Query('status') status?: string, @Query('search') search?: string) {
    const user = req.user
    const createdById = user?.role === 'COMMERCIAL' ? user.id : undefined
    return this.clientsService.findAll({ status, search, createdById })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Détail client' })
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id)
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Télécharger la fiche client en PDF' })
  async downloadPdf(@Param('id') id: string, @Res() res: any) {
    const pdf = await this.clientsService.generateClientPdf(id)
    const client = await this.clientsService.findOne(id)
    const filename = (client as any)?.name?.replace(/[^a-zA-Z0-9]/g, '_') ?? 'client'
    res.set('Content-Type', 'application/pdf')
    res.set('Content-Disposition', `attachment; filename="fiche_${filename}.pdf"`)
    res.send(pdf)
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Statistiques financières client' })
  getStats(@Param('id') id: string) {
    return this.clientsService.getStats(id)
  }

  @Get(':id/complaints')
  @ApiOperation({ summary: 'Réclamations client' })
  getComplaints(@Param('id') id: string) {
    return this.clientsService.getComplaints(id)
  }

  @Post()
  @Roles('DIRECTEUR_GENERAL', 'COMMERCIAL')
  @ApiOperation({ summary: 'Créer un client/prospect' })
  create(@Request() req: any, @Body() body: any) {
    return this.clientsService.create({ ...body, createdById: req.user?.id ?? body.createdById })
  }

  @Patch(':id')
  @Roles('DIRECTEUR_GENERAL', 'COMMERCIAL')
  @ApiOperation({ summary: 'Modifier un client' })
  async update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const old = await this.clientsService.findOne(id)
    const updated = await this.clientsService.update(id, body)
    await this.audit.log({ userId: req.user?.sub, action: 'UPDATE', entity: 'Client', entityId: id, oldData: old, newData: body })
    return updated
  }

  @Delete(':id')
  @Roles('DIRECTEUR_GENERAL')
  @ApiOperation({ summary: 'Supprimer un client' })
  async remove(@Param('id') id: string, @Request() req: any) {
    const old = await this.clientsService.findOne(id)
    const result = await this.clientsService.remove(id)
    await this.audit.log({ userId: req.user?.sub, action: 'DELETE', entity: 'Client', entityId: id, oldData: old })
    return result
  }

  @Post(':id/complaints')
  @ApiOperation({ summary: 'Créer une réclamation' })
  createComplaint(@Param('id') clientId: string, @Body() body: any) {
    return this.clientsService.createComplaint(clientId, body)
  }

  @Post(':id/contacts')
  @Roles('DIRECTEUR_GENERAL', 'COMMERCIAL')
  @ApiOperation({ summary: 'Ajouter un contact secondaire' })
  addContact(@Param('id') clientId: string, @Body() body: any) {
    return this.clientsService.addContact(clientId, body)
  }

  @Post(':id/contacts/:contactId/delete')
  @Roles('DIRECTEUR_GENERAL', 'COMMERCIAL')
  @ApiOperation({ summary: 'Supprimer un contact secondaire' })
  removeContact(@Param('contactId') contactId: string) {
    return this.clientsService.removeContact(contactId)
  }
}
