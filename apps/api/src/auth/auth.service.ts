import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'
import { LoginDto } from './dto/login.dto'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { agent: true },
    })
    if (!user) throw new UnauthorizedException('Identifiants invalides')
    if (user.status !== 'ACTIF') throw new ForbiddenException('Compte suspendu ou inactif')

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw new UnauthorizedException('Identifiants invalides')

    return user
  }

  async login(dto: LoginDto) {
    const user = await this.validateUser(dto.email, dto.password)

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const payload = { sub: user.id, email: user.email, role: user.role }
    const token = this.jwt.sign(payload)

    const { passwordHash, ...safeUser } = user
    return { token, user: safeUser }
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, phone: true, role: true, status: true,
        firstName: true, lastName: true, photoUrl: true, whatsappPhone: true,
        lastLoginAt: true, createdAt: true,
        agent: { select: { id: true, matricule: true, position: true, status: true } },
      },
    })
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new UnauthorizedException()

    const valid = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!valid) throw new UnauthorizedException('Mot de passe actuel incorrect')

    const hash = await bcrypt.hash(newPassword, 12)
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash },
    })
    return { message: 'Mot de passe modifié avec succès' }
  }

  async hashPassword(password: string) {
    return bcrypt.hash(password, 12)
  }
}
