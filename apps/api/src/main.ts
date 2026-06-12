import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe, VersioningType } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'

// Fix Decimal/BigInt serialization for Prisma
(BigInt.prototype as any).toJSON = function () { return Number(this) }

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn', 'log'] })

  // CORS
  app.enableCors({
    origin: (origin, callback) => {
      const allowed = process.env.ALLOWED_ORIGINS?.split(',') ?? []
      const isDev   = process.env.NODE_ENV !== 'production'
      if (!origin || isDev || allowed.includes(origin)) return callback(null, true)
      callback(new Error(`CORS bloqué: ${origin}`))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  // Versioning
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
  app.setGlobalPrefix('api')

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('SAGARD SÉCURITÉ API')
    .setDescription('API de gestion pour SAGARD SÉCURITÉ — Agence de sécurité privée')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document)

  const port = process.env.PORT ?? 3001
  await app.listen(port)
  console.log(`🚀 SAGARD API running on http://localhost:${port}/api`)
  console.log(`📖 Swagger docs: http://localhost:${port}/api/docs`)
}

bootstrap()
