import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as Minio from 'minio'
import * as path from 'path'
import * as crypto from 'crypto'

@Injectable()
export class StorageService {
  private client: Minio.Client

  constructor(private config: ConfigService) {
    this.client = new Minio.Client({
      endPoint:  this.config.get('MINIO_HOST', 'localhost'),
      port:      parseInt(this.config.get('MINIO_PORT', '9000')),
      useSSL:    this.config.get('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.config.get('MINIO_ACCESS_KEY', 'sagard_minio'),
      secretKey: this.config.get('MINIO_SECRET_KEY', 'sagard_minio_2024'),
    })
  }

  async upload(bucket: string, file: Express.Multer.File): Promise<{ url: string; key: string }> {
    try {
      const exists = await this.client.bucketExists(bucket)
      if (!exists) await this.client.makeBucket(bucket, 'us-east-1')

      const ext = path.extname(file.originalname)
      const key = `${crypto.randomUUID()}${ext}`
      await this.client.putObject(bucket, key, file.buffer, file.size, { 'Content-Type': file.mimetype })

      const url = `${this.config.get('MINIO_PUBLIC_URL', 'http://localhost:9000')}/${bucket}/${key}`
      return { url, key }
    } catch (e: any) {
      throw new InternalServerErrorException(`Erreur upload: ${e.message}`)
    }
  }

  async getPresignedUrl(bucket: string, key: string, expiresSeconds = 3600): Promise<{ url: string }> {
    const url = await this.client.presignedGetObject(bucket, key, expiresSeconds)
    return { url }
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    await this.client.removeObject(bucket, key)
  }
}
