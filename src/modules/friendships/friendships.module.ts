import { Module } from '@nestjs/common';
import { FriendshipsController } from './friendships.controller';
import { FriendshipsRepository } from './friendships.repository';
import { FriendshipsService } from './friendships.service';

@Module({
  controllers: [FriendshipsController],
  providers: [FriendshipsService, FriendshipsRepository],
  exports: [FriendshipsService, FriendshipsRepository],
})
export class FriendshipsModule {}
