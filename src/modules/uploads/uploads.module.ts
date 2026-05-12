import { Module } from '@nestjs/common';
import { LocalStorageDriver } from './storage/local-storage.driver';
import { STORAGE_DRIVER } from './storage/storage.interface';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController],
  providers: [
    UploadsService,
    LocalStorageDriver,
    { provide: STORAGE_DRIVER, useExisting: LocalStorageDriver },
  ],
  exports: [UploadsService],
})
export class UploadsModule {}
