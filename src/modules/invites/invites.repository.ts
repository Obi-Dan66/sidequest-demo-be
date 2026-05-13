import { Injectable } from '@nestjs/common';
import { Invite, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InvitesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.InviteCreateInput): Promise<Invite> {
    return this.prisma.invite.create({ data });
  }

  findById(id: string): Promise<Invite | null> {
    return this.prisma.invite.findUnique({ where: { id } });
  }

  findByToken(token: string): Promise<Invite | null> {
    return this.prisma.invite.findUnique({ where: { token } });
  }

  listForInviter(inviterId: string): Promise<Invite[]> {
    return this.prisma.invite.findMany({
      where: { inviterId },
      orderBy: { sentAt: 'desc' },
    });
  }

  countInvitesSince(inviterId: string, since: Date): Promise<number> {
    return this.prisma.invite.count({
      where: { inviterId, sentAt: { gte: since } },
    });
  }
}
