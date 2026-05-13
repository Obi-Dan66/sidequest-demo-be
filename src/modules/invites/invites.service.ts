import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FriendshipStatus, InviteStatus, Prisma, UserStatus } from '@prisma/client';
import * as crypto from 'node:crypto';
import { levelFromXp } from '../../common/gamification/xp';
import {
  buildInviteTokenRegisterLink,
  buildPersonalRegisterRefLink,
} from '../../common/invite/build-register-links.util';
import { PrismaService } from '../../prisma/prisma.service';
import { EventsBus } from '../events/events.bus';
import { AppEvents } from '../events/events.types';
import { UsersService } from '../users/users.service';
import { InviteCreatedDto, InviteListItemDto, InviteTokenPreviewDto } from './dto/invite.dto';
import { InvitesRepository } from './invites.repository';

const REFERRAL_XP = 50;
const INVITE_EXPIRY_MS = 30 * 86_400_000;
const MAX_INVITES_PER_UTC_DAY = 20;
const INVITE_TOKEN_BYTES = 24;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export interface ReferralTxOutcome {
  friendshipId: string;
  inviterId: string;
  inviteeId: string;
  inviterPrevLevel: number;
  inviterNewLevel: number;
  inviteePrevLevel: number;
  inviteeNewLevel: number;
}

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    private readonly invites: InvitesRepository,
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly events: EventsBus,
    private readonly config: ConfigService,
  ) {}

  async createInvite(inviterId: string, rawEmail: string): Promise<InviteCreatedDto> {
    const email = normalizeEmail(rawEmail);
    if (!email) throw new BadRequestException('Email is required');

    const inviter = await this.usersService.findRawById(inviterId);
    if (!inviter) throw new ForbiddenException({ message: 'Inviter not found', code: 'FORBIDDEN' });
    if (normalizeEmail(inviter.email) === email) {
      throw new BadRequestException('You cannot invite your own email');
    }

    const existingUser = await this.usersService.findRawByEmail(email);
    if (existingUser && existingUser.status === UserStatus.ACTIVE) {
      throw new ConflictException({
        message: 'An active account already uses this email',
        code: 'USER_EXISTS',
      });
    }

    const dayStart = startOfUtcDay(new Date());
    const sentToday = await this.invites.countInvitesSince(inviterId, dayStart);
    if (sentToday >= MAX_INVITES_PER_UTC_DAY) {
      throw new HttpException(
        { message: 'Daily invite limit reached', code: 'RATE_LIMITED' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.prisma.invite.updateMany({
      where: { inviterId, email, status: InviteStatus.PENDING },
      data: { status: InviteStatus.CANCELLED },
    });

    const token = crypto.randomBytes(INVITE_TOKEN_BYTES).toString('hex');
    const invite = await this.invites.create({
      token,
      email,
      inviter: { connect: { id: inviterId } },
    });

    const frontend = this.config.get<string>('app.frontendUrl') ?? 'http://localhost:5173';
    const inviteLink = buildInviteTokenRegisterLink(frontend, token);
    this.logger.log(`Invite email (stub) → ${email}: ${inviteLink}`);

    return { id: invite.id, email: invite.email, inviteLink };
  }

  async listMine(inviterId: string): Promise<InviteListItemDto[]> {
    const rows = await this.invites.listForInviter(inviterId);
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      status: r.status,
      sentAt: r.sentAt,
      acceptedAt: r.acceptedAt,
      inviteeId: r.inviteeId,
    }));
  }

  async cancel(inviterId: string, inviteId: string): Promise<void> {
    const inv = await this.invites.findById(inviteId);
    if (!inv) throw new NotFoundException('Invite not found');
    if (inv.inviterId !== inviterId) {
      throw new ForbiddenException({
        message: 'Not allowed to cancel this invite',
        code: 'FORBIDDEN',
      });
    }
    if (inv.status !== InviteStatus.PENDING) {
      throw new BadRequestException('Only pending invites can be cancelled');
    }
    await this.prisma.invite.update({
      where: { id: inviteId },
      data: { status: InviteStatus.CANCELLED },
    });
  }

  async previewToken(token: string): Promise<InviteTokenPreviewDto> {
    const inv = await this.invites.findByToken(token);
    if (!inv) {
      return { valid: false, expired: false };
    }
    const expired = Date.now() - inv.sentAt.getTime() > INVITE_EXPIRY_MS;
    if (inv.status !== InviteStatus.PENDING) {
      return { valid: false, expired: false };
    }
    if (expired) {
      return { valid: false, expired: true };
    }
    const inviter = await this.usersService.findRawById(inv.inviterId);
    return {
      valid: true,
      expired: false,
      inviterUsername: inviter?.username,
      invitedEmail: inv.email,
    };
  }

  /**
   * Called inside the same Prisma transaction as user creation.
   */
  async consumeReferralInviteTx(
    tx: Prisma.TransactionClient,
    token: string,
    inviteeId: string,
    inviteeEmail: string,
  ): Promise<ReferralTxOutcome> {
    const emailNorm = normalizeEmail(inviteeEmail);
    const invite = await tx.invite.findUnique({ where: { token } });
    if (!invite) {
      throw new BadRequestException('Invalid invite token');
    }
    if (invite.status !== InviteStatus.PENDING) {
      throw new BadRequestException('Invite is no longer valid');
    }
    if (Date.now() - invite.sentAt.getTime() > INVITE_EXPIRY_MS) {
      throw new BadRequestException('Invite has expired');
    }
    if (normalizeEmail(invite.email) !== emailNorm) {
      throw new BadRequestException('Registration email must match the invite');
    }
    if (invite.inviterId === inviteeId) {
      throw new BadRequestException('Invalid invite');
    }

    const claimed = await tx.invite.updateMany({
      where: { id: invite.id, status: InviteStatus.PENDING, token },
      data: {
        status: InviteStatus.ACCEPTED,
        inviteeId,
        acceptedAt: new Date(),
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException('Invite was already used');
    }

    const inviterId = invite.inviterId;
    const existing = await tx.friendship.findFirst({
      where: {
        OR: [
          { requesterId: inviterId, addresseeId: inviteeId },
          { requesterId: inviteeId, addresseeId: inviterId },
        ],
      },
    });
    let friendshipId: string;
    if (existing) {
      friendshipId = existing.id;
    } else {
      const f = await tx.friendship.create({
        data: {
          requesterId: inviterId,
          addresseeId: inviteeId,
          status: FriendshipStatus.ACCEPTED,
          respondedAt: new Date(),
        },
      });
      friendshipId = f.id;
    }

    const inviterBefore = await tx.user.findUnique({
      where: { id: inviterId },
      select: { xp: true, level: true },
    });
    const inviteeBefore = await tx.user.findUnique({
      where: { id: inviteeId },
      select: { xp: true, level: true },
    });
    if (!inviterBefore || !inviteeBefore) {
      throw new BadRequestException('User not found for referral bonus');
    }

    const inviterXp = inviterBefore.xp + REFERRAL_XP;
    const inviteeXp = inviteeBefore.xp + REFERRAL_XP;
    const inviterLevel = levelFromXp(inviterXp);
    const inviteeLevel = levelFromXp(inviteeXp);

    await tx.user.update({
      where: { id: inviterId },
      data: { xp: inviterXp, level: inviterLevel },
    });
    await tx.user.update({
      where: { id: inviteeId },
      data: { xp: inviteeXp, level: inviteeLevel },
    });

    return {
      friendshipId,
      inviterId,
      inviteeId,
      inviterPrevLevel: inviterBefore.level,
      inviterNewLevel: inviterLevel,
      inviteePrevLevel: inviteeBefore.level,
      inviteeNewLevel: inviteeLevel,
    };
  }

  emitReferralCompleted(out: ReferralTxOutcome): void {
    this.events.emit(AppEvents.FriendRequestAccepted, {
      requesterId: out.inviterId,
      addresseeId: out.inviteeId,
      friendshipId: out.friendshipId,
    });
    if (out.inviterNewLevel > out.inviterPrevLevel) {
      this.events.emit(AppEvents.LevelUp, {
        userId: out.inviterId,
        previousLevel: out.inviterPrevLevel,
        newLevel: out.inviterNewLevel,
      });
    }
    if (out.inviteeNewLevel > out.inviteePrevLevel) {
      this.events.emit(AppEvents.LevelUp, {
        userId: out.inviteeId,
        previousLevel: out.inviteePrevLevel,
        newLevel: out.inviteeNewLevel,
      });
    }
  }

  buildPersonalInviteLink(username: string): string {
    const frontend = this.config.get<string>('app.frontendUrl') ?? 'http://localhost:5173';
    return buildPersonalRegisterRefLink(frontend, username);
  }
}
