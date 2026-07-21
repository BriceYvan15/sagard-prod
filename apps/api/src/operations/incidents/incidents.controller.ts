import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Request } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { IncidentsService } from './incidents.service'

@ApiTags('Incidents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private incidents: IncidentsService) {}

  @Get()        findAll(@Query() q: any) { return this.incidents.findAll(q) }
  @Get(':id')   findOne(@Param('id') id: string) { return this.incidents.findOne(id) }
  @Post()       create(@Body() body: any) { return this.incidents.create(body) }
  @Patch(':id') update(@Param('id') id: string, @Body() body: any) { return this.incidents.update(id, body) }

  @Post(':id/photo')
  @ApiOperation({ summary: 'Uploader une photo associée à un incident' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const dir = join(process.cwd(), 'uploads', 'incidents')
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
        cb(null, dir)
      },
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9)
        cb(null, unique + extname(file.originalname))
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) return cb(new BadRequestException('Fichier image requis'), false)
      cb(null, true)
    },
  }))
  uploadPhoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu')
    const photoUrl = `/uploads/incidents/${file.filename}`
    return this.incidents.updatePhoto(id, photoUrl)
  }

  @Post(':id/investigate') @ApiOperation({ summary: "Passer en investigation" })
  investigate(@Param('id') id: string) { return this.incidents.investigate(id) }
  @Post(':id/resolve')     @ApiOperation({ summary: "Marquer résolu" })
  resolve(@Param('id') id: string, @Body() body: { resolution?: string }) { return this.incidents.resolve(id, body?.resolution) }
  @Post(':id/close')       @ApiOperation({ summary: "Clore l'incident" })
  close(@Param('id') id: string) { return this.incidents.close(id) }

  @Post(':id/agents')
  addAgent(@Param('id') id: string, @Body() body: { agentId: string; role?: string }) {
    return this.incidents.addAgent(id, body.agentId, body.role)
  }
  @Post(':id/agents/:agentId/remove')
  removeAgent(@Param('id') id: string, @Param('agentId') agentId: string) {
    return this.incidents.removeAgent(id, agentId)
  }

  @Post(':id/ops-report')
  @ApiOperation({ summary: "Soumettre un rapport d'incident (chef des opérations)" })
  submitOpsReport(@Param('id') id: string, @Body() body: { report: string }, @Request() req: any) {
    return this.incidents.submitOpsReport(id, body.report, req.user?.sub ?? 'system')
  }

  @Post(':id/ops-report/validate')
  @ApiOperation({ summary: "Valider le rapport d'incident (DG)" })
  validateOpsReport(@Param('id') id: string, @Request() req: any) {
    return this.incidents.validateOpsReport(id, req.user?.sub ?? 'system')
  }

  @Post(':id/ops-report/reject')
  @ApiOperation({ summary: "Rejeter le rapport d'incident (DG)" })
  rejectOpsReport(@Param('id') id: string, @Body() body: { reason?: string }, @Request() req: any) {
    return this.incidents.rejectOpsReport(id, req.user?.sub ?? 'system', body?.reason)
  }
}
