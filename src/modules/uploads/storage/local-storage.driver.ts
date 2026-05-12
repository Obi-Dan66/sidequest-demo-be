import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { StorageDriver, StoredObject } from './storage.interface';

@Injectable()
export class LocalStorageDriver implements StorageDriver {
  private readonly logger = new Logger(LocalStorageDriver.name);
  private readonly dir: string;

  constructor(config: ConfigService) {
    this.dir = resolve(config.get<string>('uploads.dir') || './uploads');
  }

  async save(input: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
  }): Promise<StoredObject> {
    await fs.mkdir(this.dir, { recursive: true });

    const ext = extname(input.originalName) || this.extensionFromMime(input.mimeType);
    const filename = `${Date.now()}-${randomBytes(8).toString('hex')}${ext}`;
    const fullPath = join(this.dir, filename);

    await fs.writeFile(fullPath, input.buffer);
    this.logger.debug(`Stored upload at ${fullPath}`);

    return {
      filename,
      url: `/uploads/${filename}`,
      sizeBytes: input.buffer.length,
      mimeType: input.mimeType,
    };
  }

  async delete(filename: string): Promise<void> {
    const fullPath = join(this.dir, filename);
    await fs.rm(fullPath, { force: true });
  }

  private extensionFromMime(mime: string): string {
    if (mime === 'image/png') return '.png';
    if (mime === 'image/jpeg' || mime === 'image/jpg') return '.jpg';
    if (mime === 'image/webp') return '.webp';
    return '';
  }
}
