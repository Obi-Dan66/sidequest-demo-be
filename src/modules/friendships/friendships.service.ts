import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FriendshipStatus } from '@prisma/client';
import { EventsBus } from '../events/events.bus';
import { AppEvents } from '../events/events.types';
import { FriendshipDto } from './dto/friendship.dto';
import { FriendshipsRepository } from './friendships.repository';

@Injectable()
export class FriendshipsService {
  constructor(
    private readonly friendships: FriendshipsRepository,
    private readonly events: EventsBus,
  ) {}

  async request(requesterId: string, addresseeId: string): Promise<FriendshipDto> {
    if (requesterId === addresseeId) {
      throw new BadRequestException('Cannot send a friend request to yourself');
    }
    const existing = await this.friendships.findBetween(requesterId, addresseeId);
    if (existing) throw new ConflictException('Friendship already exists');

    const created = await this.friendships.create(requesterId, addresseeId);
    this.events.emit(AppEvents.FriendRequestSent, { requesterId, addresseeId });
    return FriendshipDto.fromEntity(created);
  }

  async accept(userId: string, friendshipId: string): Promise<FriendshipDto> {
    const f = await this.friendships.findById(friendshipId);
    if (!f) throw new NotFoundException('Friendship not found');
    if (f.addresseeId !== userId) throw new ForbiddenException('Only the addressee can accept');
    if (f.status !== FriendshipStatus.PENDING) {
      throw new BadRequestException('Friendship is not pending');
    }
    const updated = await this.friendships.updateStatus(friendshipId, FriendshipStatus.ACCEPTED);
    this.events.emit(AppEvents.FriendRequestAccepted, {
      requesterId: f.requesterId,
      addresseeId: f.addresseeId,
    });
    return FriendshipDto.fromEntity(updated);
  }

  async block(userId: string, otherUserId: string): Promise<FriendshipDto> {
    let f = await this.friendships.findBetween(userId, otherUserId);
    if (!f) {
      f = await this.friendships.create(userId, otherUserId);
    }
    const updated = await this.friendships.updateStatus(f.id, FriendshipStatus.BLOCKED);
    return FriendshipDto.fromEntity(updated);
  }

  async remove(userId: string, friendshipId: string): Promise<void> {
    const f = await this.friendships.findById(friendshipId);
    if (!f) throw new NotFoundException('Friendship not found');
    if (f.requesterId !== userId && f.addresseeId !== userId) {
      throw new ForbiddenException('Not allowed');
    }
    await this.friendships.delete(friendshipId);
  }

  async listMine(userId: string, status?: FriendshipStatus): Promise<FriendshipDto[]> {
    const all = await this.friendships.listForUser(userId, status);
    return all.map(FriendshipDto.fromEntity);
  }
}
