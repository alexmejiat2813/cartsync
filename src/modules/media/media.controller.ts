import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UploadMediaDto } from './dto/upload-media.dto';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

@ApiTags('media')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_MIME.includes(file.mimetype)) {
          return cb(new BadRequestException(`Unsupported MIME type: ${file.mimetype}`), false);
        }
        cb(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload product or receipt image to cloud storage' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'entityType'],
      properties: {
        file: { type: 'string', format: 'binary' },
        entityType: { type: 'string', enum: ['product', 'receipt', 'supermarket'] },
        entityId: { type: 'string', format: 'uuid', description: 'Optional — attach to existing entity' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Returns public URL of uploaded file' })
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadMediaDto,
    @CurrentUser() userId: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    return this.mediaService.upload(file, body, userId);
  }
}
