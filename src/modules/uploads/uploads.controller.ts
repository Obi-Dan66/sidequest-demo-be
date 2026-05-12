import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UploadResponseDto } from './dto/upload-response.dto';
import { UploadsService } from './uploads.service';

interface UploadedFileLike {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

function isUploadedFile(value: unknown): value is UploadedFileLike {
  if (typeof value !== 'object' || value === null) return false;
  const buffer = Reflect.get(value, 'buffer');
  const originalname = Reflect.get(value, 'originalname');
  const mimetype = Reflect.get(value, 'mimetype');
  return (
    Buffer.isBuffer(buffer) && typeof originalname === 'string' && typeof mimetype === 'string'
  );
}

@ApiTags('uploads')
@ApiBearerAuth('access-token')
@Controller({ path: 'uploads', version: '1' })
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload a file (image)' })
  async upload(@UploadedFile() file: unknown): Promise<UploadResponseDto> {
    if (!isUploadedFile(file)) throw new BadRequestException('No file uploaded');

    const stored = await this.uploadsService.upload({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
    });

    return {
      filename: stored.filename,
      url: stored.url,
      sizeBytes: stored.sizeBytes,
      mimeType: stored.mimeType,
    };
  }
}
