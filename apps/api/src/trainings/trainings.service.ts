import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from '../notifications/notifications.service'

@Injectable()
export class TrainingsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ── Sessions CRUD (ERP) ──────────────────────────────────────────

  async createSession(data: {
    title: string
    description?: string
    type: string
    trainer?: string
    location?: string
    startDate?: Date
    endDate?: Date
    passingScore?: number
    content?: string
    videoUrl?: string
    createdById?: string
  }) {
    return this.prisma.trainingSession.create({
      data: {
        title: data.title,
        description: data.description,
        type: data.type as any,
        trainer: data.trainer,
        location: data.location,
        startDate: data.startDate,
        endDate: data.endDate,
        passingScore: data.passingScore ?? 70,
        content: data.content,
        videoUrl: data.videoUrl,
        createdById: data.createdById,
      },
      include: { questions: true, participants: true },
    })
  }

  async findAllSessions(filters?: { status?: string; type?: string }) {
    return this.prisma.trainingSession.findMany({
      where: {
        ...(filters?.status && { status: filters.status as any }),
        ...(filters?.type && { type: filters.type as any }),
      },
      include: {
        _count: { select: { participants: true, questions: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOneSession(id: string) {
    const session = await this.prisma.trainingSession.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { createdAt: 'asc' } },
        participants: {
          include: {
            agent: {
              select: {
                id: true, matricule: true,
                user: { select: { id: true, firstName: true, lastName: true, phone: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })
    if (!session) throw new NotFoundException('Session de formation introuvable')
    return session
  }

  async updateSession(id: string, data: any) {
    const session = await this.prisma.trainingSession.findUnique({ where: { id } })
    if (!session) throw new NotFoundException('Session introuvable')
    if (session.status === 'PUBLIEE') throw new BadRequestException('Une session publiée ne peut plus être modifiée')

    return this.prisma.trainingSession.update({
      where: { id },
      data: {
        ...(data.title && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.trainer !== undefined && { trainer: data.trainer }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.startDate !== undefined && { startDate: data.startDate }),
        ...(data.endDate !== undefined && { endDate: data.endDate }),
        ...(data.passingScore !== undefined && { passingScore: data.passingScore }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl }),
      },
      include: { questions: true, participants: true },
    })
  }

  async deleteSession(id: string) {
    const session = await this.prisma.trainingSession.findUnique({ where: { id } })
    if (!session) throw new NotFoundException('Session introuvable')
    if (session.status === 'PUBLIEE') throw new BadRequestException('Une session publiée ne peut pas être supprimée')

    return this.prisma.trainingSession.delete({ where: { id } })
  }

  // ── Questions (ERP) ─────────────────────────────────────────────

  async addQuestion(sessionId: string, data: {
    question: string
    options: string[]
    correctIndex: number
    points?: number
  }) {
    const session = await this.prisma.trainingSession.findUnique({ where: { id: sessionId } })
    if (!session) throw new NotFoundException('Session introuvable')
    if (session.status === 'PUBLIEE') throw new BadRequestException('Une session publiée ne peut plus être modifiée')

    return this.prisma.trainingQuestion.create({
      data: {
        sessionId,
        question: data.question,
        options: data.options,
        correctIndex: data.correctIndex,
        points: data.points ?? 1,
      },
    })
  }

  async deleteQuestion(sessionId: string, questionId: string) {
    const session = await this.prisma.trainingSession.findUnique({ where: { id: sessionId } })
    if (!session) throw new NotFoundException('Session introuvable')
    if (session.status === 'PUBLIEE') throw new BadRequestException('Une session publiée ne peut plus être modifiée')

    return this.prisma.trainingQuestion.delete({ where: { id: questionId } })
  }

  // ── Participants (ERP) ───────────────────────────────────────────

  async assignParticipants(sessionId: string, agentIds: string[]) {
    const session = await this.prisma.trainingSession.findUnique({ where: { id: sessionId } })
    if (!session) throw new NotFoundException('Session introuvable')

    // Remove participants not in the new list
    await this.prisma.trainingParticipant.deleteMany({
      where: { sessionId, agentId: { notIn: agentIds } },
    })

    // Add new participants (skip existing)
    for (const agentId of agentIds) {
      await this.prisma.trainingParticipant.upsert({
        where: { sessionId_agentId: { sessionId, agentId } },
        create: { sessionId, agentId },
        update: {},
      })
    }

    return this.prisma.trainingSession.findUnique({
      where: { id: sessionId },
      include: { _count: { select: { participants: true } } },
    })
  }

  async updateParticipant(participantId: string, data: {
    status?: string
    score?: number
  }) {
    return this.prisma.trainingParticipant.update({
      where: { id: participantId },
      data: {
        ...(data.status && { status: data.status as any }),
        ...(data.score !== undefined && { score: data.score }),
        ...(data.status === 'REUSSI' || data.status === 'ECHOUE' || data.status === 'TERMINE' ? { completedAt: new Date() } : {}),
      },
    })
  }

  // ── Publish + Notify ────────────────────────────────────────────

  async publishSession(id: string) {
    const session = await this.prisma.trainingSession.findUnique({
      where: { id },
      include: { questions: true, participants: { include: { agent: { select: { userId: true } } } } },
    })
    if (!session) throw new NotFoundException('Session introuvable')
    if (session.status === 'PUBLIEE') throw new BadRequestException('Session déjà publiée')
    if (session.type === 'QCM' && session.questions.length === 0) throw new BadRequestException('Un QCM doit avoir au moins une question')
    if (session.participants.length === 0) throw new BadRequestException('Aucun participant assigné')

    const updated = await this.prisma.trainingSession.update({
      where: { id },
      data: { status: 'PUBLIEE' },
    })

    // Notify each participant's user
    for (const p of session.participants) {
      if (p.agent?.userId) {
        await this.notifications.create({
          userId: p.agent.userId,
          type: 'FORMATION' as any,
          title: 'Nouvelle formation assignée',
          message: `Vous avez été assigné à la formation « ${session.title} »`,
          data: { sessionId: id, type: session.type },
        })
      }
    }

    return updated
  }

  // ── Agent side (Mobile) ──────────────────────────────────────────

  async getMyTrainings(userId: string) {
    const agent = await this.prisma.agent.findFirst({ where: { userId } })
    if (!agent) throw new NotFoundException('Agent introuvable')

    const participants = await this.prisma.trainingParticipant.findMany({
      where: { agentId: agent.id },
      include: {
        session: {
          select: {
            id: true, title: true, description: true, type: true, status: true,
            trainer: true, location: true, startDate: true, endDate: true,
            passingScore: true, content: true, videoUrl: true,
            _count: { select: { questions: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return participants.map(p => ({
      participantId: p.id,
      status: p.status,
      score: p.score,
      startedAt: p.startedAt,
      completedAt: p.completedAt,
      session: p.session,
    }))
  }

  async getTrainingDetail(userId: string, sessionId: string) {
    const agent = await this.prisma.agent.findFirst({ where: { userId } })
    if (!agent) throw new NotFoundException('Agent introuvable')

    const participant = await this.prisma.trainingParticipant.findFirst({
      where: { sessionId, agentId: agent.id },
      include: {
        session: {
          include: {
            questions: { select: { id: true, question: true, options: true, points: true } },
          },
        },
      },
    })
    if (!participant) throw new NotFoundException('Formation introuvable ou non assignée')
    if (participant.session.status !== 'PUBLIEE') throw new BadRequestException('Formation non disponible')

    // Mark as EN_COURS if ASSIGNEE
    if (participant.status === 'ASSIGNEE') {
      await this.prisma.trainingParticipant.update({
        where: { id: participant.id },
        data: { status: 'EN_COURS', startedAt: new Date() },
      })
    }

    // For QCM: don't send correctIndex to the agent
    const questions = participant.session.questions.map(q => ({
      id: q.id,
      question: q.question,
      options: q.options,
      points: q.points,
    }))

    return {
      participantId: participant.id,
      status: participant.status === 'ASSIGNEE' ? 'EN_COURS' : participant.status,
      score: participant.score,
      session: {
        id: participant.session.id,
        title: participant.session.title,
        description: participant.session.description,
        type: participant.session.type,
        trainer: participant.session.trainer,
        location: participant.session.location,
        startDate: participant.session.startDate,
        endDate: participant.session.endDate,
        passingScore: participant.session.passingScore,
        content: participant.session.content,
        videoUrl: participant.session.videoUrl,
        questions,
      },
    }
  }

  async submitTraining(userId: string, sessionId: string, data: {
    answers?: { questionId: string; selectedIndex: number }[]
  }) {
    const agent = await this.prisma.agent.findFirst({ where: { userId } })
    if (!agent) throw new NotFoundException('Agent introuvable')

    const participant = await this.prisma.trainingParticipant.findFirst({
      where: { sessionId, agentId: agent.id },
      include: { session: { include: { questions: true } } },
    })
    if (!participant) throw new NotFoundException('Formation introuvable')
    if (participant.status === 'TERMINE' || participant.status === 'REUSSI' || participant.status === 'ECHOUE') {
      throw new BadRequestException('Formation déjà terminée')
    }

    const session = participant.session

    // QCM: calculate score
    if (session.type === 'QCM') {
      if (!data.answers || data.answers.length === 0) throw new BadRequestException('Réponses requises pour un QCM')

      let earnedPoints = 0
      let totalPoints = 0
      const answersData: any[] = []

      for (const q of session.questions) {
        totalPoints += q.points
        const answer = data.answers.find(a => a.questionId === q.id)
        if (answer && answer.selectedIndex === q.correctIndex) {
          earnedPoints += q.points
        }
        answersData.push({
          questionId: q.id,
          selectedIndex: answer?.selectedIndex ?? null,
          correct: answer?.selectedIndex === q.correctIndex,
        })
      }

      const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0
      const passed = score >= session.passingScore

      return this.prisma.trainingParticipant.update({
        where: { id: participant.id },
        data: {
          status: passed ? 'REUSSI' : 'ECHOUE',
          score,
          answers: answersData as any,
          completedAt: new Date(),
        },
      })
    }

    // LECTURE / VIDEO: mark as completed
    if (session.type === 'LECTURE' || session.type === 'VIDEO') {
      return this.prisma.trainingParticipant.update({
        where: { id: participant.id },
        data: {
          status: 'TERMINE',
          completedAt: new Date(),
          answers: { acknowledged: true } as any,
        },
      })
    }

    // PRATIQUE: mark as EN_COURS (awaiting RH validation)
    if (session.type === 'PRATIQUE') {
      return this.prisma.trainingParticipant.update({
        where: { id: participant.id },
        data: {
          status: 'TERMINE',
          completedAt: new Date(),
          answers: { submittedForReview: true } as any,
        },
      })
    }

    throw new BadRequestException('Type de formation non supporté')
  }
}
