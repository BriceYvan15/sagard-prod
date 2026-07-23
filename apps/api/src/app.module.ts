import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule } from '@nestjs/throttler'
import { BullModule } from '@nestjs/bull'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'
import { ClientsModule } from './crm/clients/clients.module'
import { ContractsModule } from './crm/contracts/contracts.module'
import { InvoicesModule } from './crm/invoices/invoices.module'
import { BillingRunsModule } from './crm/billing-runs/billing-runs.module'
import { LeadsModule } from './crm/leads/leads.module'
import { SitesModule } from './operations/sites/sites.module'
import { AgentsModule } from './operations/agents/agents.module'
import { DeploymentsModule } from './operations/deployments/deployments.module'
import { PointagesModule } from './operations/pointages/pointages.module'
import { PatrolsModule } from './operations/patrols/patrols.module'
import { ControlsModule } from './operations/controls/controls.module'
import { TransfersModule } from './operations/transfers/transfers.module'
import { DailyReportsModule } from './operations/daily-reports/daily-reports.module'
import { IncidentsModule } from './operations/incidents/incidents.module'
import { AlertsModule } from './operations/alerts/alerts.module'
import { VisitorsModule } from './operations/visitors/visitors.module'
import { KeysModule } from './operations/keys/keys.module'
import { SiteEquipmentModule } from './operations/site-equipment/site-equipment.module'
import { HrModule } from './hr/hr.module'
import { StockModule } from './stock/stock.module'
import { NotificationsModule } from './notifications/notifications.module'
import { WhatsappModule } from './whatsapp/whatsapp.module'
import { AiModule } from './ai/ai.module'
import { StorageModule } from './storage/storage.module'
import { GatewayModule } from './gateway/gateway.module'
import { DashboardModule } from './dashboard/dashboard.module'
import { AccountingModule } from './accounting/accounting.module'
import { TreasuryModule } from './treasury/treasury.module'
import { AuditModule } from './audit/audit.module'
import { SettingsModule } from './settings/settings.module'
import { MailModule } from './mail/mail.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),

    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
        password: process.env.REDIS_PASSWORD,
      },
    }),

    PrismaModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    ContractsModule,
    InvoicesModule,
    BillingRunsModule,
    LeadsModule,
    SitesModule,
    AgentsModule,
    DeploymentsModule,
    TransfersModule,
    PointagesModule,
    PatrolsModule,
    ControlsModule,
    DailyReportsModule,
    IncidentsModule,
    AlertsModule,
    VisitorsModule,
    KeysModule,
    SiteEquipmentModule,
    HrModule,
    StockModule,
    NotificationsModule,
    WhatsappModule,
    AiModule,
    StorageModule,
    GatewayModule,
    DashboardModule,
    AccountingModule,
    TreasuryModule,
    AuditModule,
    SettingsModule,
    MailModule,
  ],
})
export class AppModule {}
