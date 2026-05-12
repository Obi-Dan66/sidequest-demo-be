import { registerAs } from '@nestjs/config';

export interface UploadsConfig {
  dir: string;
  maxFileSizeMb: number;
}

export default registerAs<UploadsConfig>('uploads', () => ({
  dir: process.env.UPLOAD_DIR || './uploads',
  maxFileSizeMb: parseInt(process.env.UPLOAD_MAX_FILE_SIZE_MB || '10', 10),
}));
