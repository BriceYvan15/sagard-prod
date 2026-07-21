import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings() {
    let settings = await this.prisma.companySetting.findFirst()
    if (!settings) {
      settings = await this.prisma.companySetting.create({
        data: {
          name: 'SAGARD SÉCURITÉ',
          phone: '',
          email: 'directionsagardci@gmail.com',
          address: "Abidjan, Côte d'Ivoire",
          rccm: '',
          ncc: '',
        },
      })
    }
    return settings
  }

  async updateSettings(data: {
    name: string
    phone?: string
    email?: string
    address: string
    rccm?: string
    ncc?: string
  }) {
    const settings = await this.getSettings()
    return this.prisma.companySetting.update({
      where: { id: settings.id },
      data,
    })
  }

  async backupDatabase(): Promise<string> {
    const dbUrl = process.env.DATABASE_URL ?? ''
    let cmd: string

    if (dbUrl) {
      cmd = `pg_dump "${dbUrl}" --no-owner --no-acl`
    } else {
      const host = process.env.DB_HOST ?? 'localhost'
      const port = process.env.DB_PORT ?? '5435'
      const name = process.env.DB_NAME ?? 'sagard_db'
      const user = process.env.DB_USER ?? 'sagard'
      const pass = process.env.DB_PASSWORD ?? ''
      cmd = `PGPASSWORD="${pass}" pg_dump -h ${host} -p ${port} -U ${user} -d ${name} --no-owner --no-acl`
    }

    // Try local pg_dump first, fallback to Docker
    try {
      const { stdout } = await execAsync(cmd, { maxBuffer: 50 * 1024 * 1024 })
      return stdout
    } catch {
      // Fallback: run pg_dump inside the sagard-postgres Docker container
      const dockerCmd = `docker exec sagard-postgres pg_dump -U sagard -d sagard_db --no-owner --no-acl`
      const { stdout } = await execAsync(dockerCmd, { maxBuffer: 50 * 1024 * 1024 })
      return stdout
    }
  }
}
