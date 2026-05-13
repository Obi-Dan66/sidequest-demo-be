import { Module } from '@nestjs/common';
import { BusinessesController } from './businesses.controller';
import { BusinessPortalRepository } from './business-portal.repository';
import { BusinessesRepository } from './businesses.repository';
import { BusinessesService } from './businesses.service';

@Module({
  controllers: [BusinessesController],
  providers: [BusinessesService, BusinessesRepository, BusinessPortalRepository],
  exports: [BusinessesService, BusinessesRepository],
})
export class BusinessesModule {}
