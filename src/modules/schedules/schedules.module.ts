import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { StreakRolloverService } from './streak-rollover.service';

@Module({
  imports: [ScheduleModule],
  providers: [StreakRolloverService],
})
export class SchedulesModule {}
