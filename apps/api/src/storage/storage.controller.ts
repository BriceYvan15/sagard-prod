import { Controller, Post, Get, Param, UploadedFile, UseInterceptors, UseGuards } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { StorageService } from './storage.service'

@ApiTags('Stockage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('storage')
export class StorageController {
  constructor(private storageService: StorageService) {}

  @Post('upload/:bucket')
  @ApiOperation({ summary: 'Upload un fichier (photo, document)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  upload(@Param('bucket') bucket: string, @UploadedFile() file: Express.Multer.File) {
    return this.storageService.upload(bucket, file)
  }

  @Get('url/:bucket/:key')
  @ApiOperation({ summary: 'Obtenir l\'URL présignée d\'un fichier' })
  getUrl(@Param('bucket') bucket: string, @Param('key') key: string) {
    return this.storageService.getPresignedUrl(bucket, key)
  }
}
