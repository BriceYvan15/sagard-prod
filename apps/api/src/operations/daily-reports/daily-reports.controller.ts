import { Controller, Get, Post, Patch, Param, Body, Query, Request, UseGuards, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { extname, join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard'
import { DailyReportsService } from './daily-reports.service'

@ApiTags('Daily Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('daily-reports')
export class DailyReportsController {
  constructor(private reports: DailyReportsService) {}

  @Get()        findAll(@Query() q: any) { return this.reports.findAll(q) }
  @Get(':id')   findOne(@Param('id') id: string) { return this.reports.findOne(id) }
  @Post()       create(@Body() body: any) { return this.reports.create(body) }
  @Patch(':id') update(@Param('id') id: string, @Body() body: any) { return this.reports.update(id, body) }

  @Post(':id/agents')
  @ApiOperation({ summary: 'Ajouter un agent présent au rapport' })
  addAgent(@Param('id') id: string, @Body() body: { agentId: string }) { return this.reports.addAgent(id, body.agentId) }

  @Post(':id/agents/:agentId/remove')
  @ApiOperation({ summary: 'Retirer un agent du rapport' })
  removeAgent(@Param('id') id: string, @Param('agentId') agentId: string) { return this.reports.removeAgent(id, agentId) }

  @Post(':id/photo')
  @ApiOperation({ summary: 'Uploader une photo associée à un rapport' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        const dir = join(process.cwd(), 'uploads', 'reports')
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
    const photoUrl = `/uploads/reports/${file.filename}`
    return this.reports.updatePhoto(id, photoUrl)
  }

  @Post(':id/submit')   @ApiOperation({ summary: 'Soumettre le rapport pour validation' })
  submit(@Param('id') id: string) { return this.reports.submit(id) }
  @Post(':id/validate') @ApiOperation({ summary: 'Valider le rapport (chef opérations)' })
  validate(@Param('id') id: string, @Request() req: any) { return this.reports.validate(id, req.user?.sub ?? 'system') }
  @Post(':id/reject')   @ApiOperation({ summary: 'Rejeter le rapport' })
  reject(@Param('id') id: string) { return this.reports.reject(id) }
  @Post(':id/reset')    @ApiOperation({ summary: 'Remettre en brouillon' })
  reset(@Param('id') id: string) { return this.reports.reset(id) }
}
