import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STORAGE_DRIVER, StorageDriver, StoredObject } from './storage/storage.interface';

const DEFAULT_ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

@Injectable()
export class UploadsService {
  private readonly maxBytes: number;

  constructor(
    @Inject(STORAGE_DRIVER) private readonly driver: StorageDriver,
    config: ConfigService,
  ) {
    const maxMb = config.get<number>('uploads.maxFileSizeMb') ?? 10;
    this.maxBytes = maxMb * 1024 * 1024;
  }

  async upload(input: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
  }): Promise<StoredObject> {
    if (!DEFAULT_ALLOWED_MIMES.has(input.mimeType)) {
      throw new BadRequestException(`Unsupported mime type: ${input.mimeType}`);
    }
    if (input.buffer.length > this.maxBytes) {
      throw new BadRequestException(`File too large (max ${this.maxBytes} bytes)`);
    }
    return this.driver.save(input);
  }

  async remove(filename: string): Promise<void> {
    await this.driver.delete(filename);
  }
}
