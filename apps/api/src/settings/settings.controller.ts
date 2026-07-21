import { Controller, Get, Put, Body, UseGuards, Res, Post } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { SettingsService } from './settings.service'

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings() {
    return this.settingsService.getSettings()
  }

  @Put()
  async updateSettings(
    @Body()
    data: {
      name: string
      phone?: string
      email?: string
      address: string
      rccm?: string
      ncc?: string
    },
  ) {
    return this.settingsService.updateSettings(data)
  }

  @Post('backup')
  async backupDatabase(@Res() res: any) {
    try {
      const dump = await this.settingsService.backupDatabase()
      const filename = `sagard-backup-${new Date().toISOString().slice(0, 10)}.sql`
      res.setHeader('Content-Type', 'application/sql')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      res.send(dump)
    } catch (err: any) {
      res.status(500).json({ message: err?.message || 'Erreur lors du backup' })
    }
  }
}
