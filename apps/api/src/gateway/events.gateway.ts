import {
  WebSocketGateway, WebSocketServer, SubscribeMessage,
  OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket,
} from '@nestjs/websockets'
import { UseGuards, Logger } from '@nestjs/common'
import { Server, Socket } from 'socket.io'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/' })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server
  private readonly logger = new Logger(EventsGateway.name)
  private connectedUsers = new Map<string, string>()

  constructor(
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1]
      if (!token) { client.disconnect(); return }

      const payload = this.jwt.verify(token)
      this.connectedUsers.set(client.id, payload.sub)
      client.join(`user:${payload.sub}`)
      client.join(`role:${payload.role}`)
      this.logger.log(`Client connecté: ${payload.email} (${client.id})`)
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket) {
    this.connectedUsers.delete(client.id)
    this.logger.log(`Client déconnecté: ${client.id}`)
  }

  @SubscribeMessage('controller:location')
  async handleControllerLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { latitude: number; longitude: number; accuracy?: number },
  ) {
    const userId = this.connectedUsers.get(client.id)
    if (!userId) return

    await this.prisma.controllerLocation.create({
      data: {
        controllerId: userId,
        latitude: data.latitude,
        longitude: data.longitude,
        accuracy: data.accuracy,
      },
    })

    this.server.to('role:CHEF_OPERATIONS').to('role:DIRECTEUR_GENERAL').emit('controller:moved', {
      controllerId: userId,
      ...data,
      timestamp: new Date().toISOString(),
    })
  }

  @SubscribeMessage('controller:arrived_site')
  async handleControllerArrivedSite(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { siteId: string; siteName: string; latitude: number; longitude: number },
  ) {
    const userId = this.connectedUsers.get(client.id)
    if (!userId) return

    const patrol = await this.prisma.controllerPatrol.create({
      data: {
        controllerId: userId,
        siteId: data.siteId,
        arrivedAt: new Date(),
        latitude: data.latitude,
        longitude: data.longitude,
      },
    })

    this.server.to('role:CHEF_OPERATIONS').to('role:DIRECTEUR_GENERAL').emit('controller:on_site', {
      controllerId: userId,
      patrolId: patrol.id,
      siteId: data.siteId,
      siteName: data.siteName,
      arrivedAt: patrol.arrivedAt,
    })

    return { patrolId: patrol.id }
  }

  @SubscribeMessage('controller:left_site')
  async handleControllerLeftSite(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { patrolId: string; agentsChecked: number; notes?: string },
  ) {
    const now = new Date()
    const patrol = await this.prisma.controllerPatrol.findUnique({ where: { id: data.patrolId } })
    if (!patrol) return

    const durationMinutes = Math.round((now.getTime() - patrol.arrivedAt.getTime()) / 60000)

    await this.prisma.controllerPatrol.update({
      where: { id: data.patrolId },
      data: {
        leftAt: now,
        durationMinutes,
        agentsChecked: data.agentsChecked,
        notes: data.notes,
      },
    })

    this.server.to('role:CHEF_OPERATIONS').to('role:DIRECTEUR_GENERAL').emit('controller:left_site', {
      patrolId: data.patrolId,
      durationMinutes,
      agentsChecked: data.agentsChecked,
    })
  }

  emitNotification(userId: string, notification: any) {
    this.server.to(`user:${userId}`).emit('notification', notification)
  }

  emitToRole(role: string, event: string, data: any) {
    this.server.to(`role:${role}`).emit(event, data)
  }
}
