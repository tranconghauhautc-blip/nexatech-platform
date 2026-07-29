import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import {
  MediaEntityType as PrismaEntityType,
  MediaOwnerType as PrismaOwnerType,
  MediaRole as PrismaMediaRole,
  MediaStatus as PrismaMediaStatus,
  Prisma,
  type MediaLink as PrismaMediaLink,
  type MediaObject as PrismaMediaObject,
} from '../../generated/prisma';
import type { MediaRepository } from './media.repository';
import type {
  CreateMediaLinkInput,
  CreatePendingMediaInput,
  MediaAuditEntry,
  MediaEntityType,
  MediaLinkRecord,
  MediaOwnerType,
  MediaRecord,
  MediaRole,
  MediaStatus,
} from './media.types';
import { PrismaService } from './prisma.service';

function toDomainStatus(status: PrismaMediaStatus): MediaStatus {
  switch (status) {
    case PrismaMediaStatus.PENDING:
      return 'pending';
    case PrismaMediaStatus.ACTIVE:
      return 'active';
    case PrismaMediaStatus.DELETED:
      return 'deleted';
  }
}

function toDomainOwnerType(ownerType: PrismaOwnerType): MediaOwnerType {
  return ownerType as MediaOwnerType;
}

function toPrismaOwnerType(ownerType: MediaOwnerType): PrismaOwnerType {
  return ownerType as PrismaOwnerType;
}

function toDomainRole(role: PrismaMediaRole): MediaRole {
  return role as MediaRole;
}

function toPrismaRole(role: MediaRole): PrismaMediaRole {
  return role as PrismaMediaRole;
}

function toDomainEntityType(entityType: PrismaEntityType): MediaEntityType {
  return entityType as MediaEntityType;
}

function toPrismaEntityType(entityType: MediaEntityType): PrismaEntityType {
  return entityType as PrismaEntityType;
}

function mapMedia(row: PrismaMediaObject): MediaRecord {
  return {
    id: row.id,
    bucket: row.bucket,
    objectKey: row.objectKey,
    fileName: row.fileName,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    status: toDomainStatus(row.status),
    ownerType: toDomainOwnerType(row.ownerType),
    ownerId: row.ownerId,
    uploadedBy: row.uploadedBy,
    etag: row.etag ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? undefined,
  };
}

function mapLink(row: PrismaMediaLink): MediaLinkRecord {
  return {
    id: row.id,
    mediaId: row.mediaId,
    entityType: toDomainEntityType(row.entityType),
    entityId: row.entityId,
    role: toDomainRole(row.role),
    sortOrder: row.sortOrder,
    isPrimary: row.isPrimary,
    createdAt: row.createdAt,
  };
}

export class PrismaMediaRepository implements MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPending(input: CreatePendingMediaInput): Promise<MediaRecord> {
    try {
      const row = await this.prisma.mediaObject.create({
        data: {
          bucket: input.bucket,
          objectKey: input.objectKey,
          fileName: input.fileName,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          status: PrismaMediaStatus.PENDING,
          ownerType: toPrismaOwnerType(input.ownerType),
          ownerId: input.ownerId,
          uploadedBy: input.uploadedBy,
        },
      });
      return mapMedia(row);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new AppError({
          errorCode: ErrorCodes.CONFLICT,
          message: 'Object key media đã tồn tại',
          details: { objectKey: input.objectKey },
        });
      }
      throw error;
    }
  }

  async findById(id: string): Promise<MediaRecord | null> {
    const row = await this.prisma.mediaObject.findUnique({ where: { id } });
    return row ? mapMedia(row) : null;
  }

  async markActive(id: string, etag?: string): Promise<MediaRecord> {
    try {
      const row = await this.prisma.mediaObject.update({
        where: { id },
        data: {
          status: PrismaMediaStatus.ACTIVE,
          etag: etag ?? undefined,
        },
      });
      return mapMedia(row);
    } catch {
      throw new AppError({
        errorCode: ErrorCodes.MEDIA_NOT_FOUND,
        message: 'Không tìm thấy media',
      });
    }
  }

  async softDelete(id: string): Promise<MediaRecord> {
    try {
      const row = await this.prisma.mediaObject.update({
        where: { id },
        data: {
          status: PrismaMediaStatus.DELETED,
          deletedAt: new Date(),
        },
      });
      return mapMedia(row);
    } catch {
      throw new AppError({
        errorCode: ErrorCodes.MEDIA_NOT_FOUND,
        message: 'Không tìm thấy media',
      });
    }
  }

  async listByOwner(
    ownerType: MediaOwnerType,
    ownerId: string,
  ): Promise<MediaRecord[]> {
    const rows = await this.prisma.mediaObject.findMany({
      where: {
        ownerType: toPrismaOwnerType(ownerType),
        ownerId,
        status: { not: PrismaMediaStatus.DELETED },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(mapMedia);
  }

  async createLink(input: CreateMediaLinkInput): Promise<MediaLinkRecord> {
    try {
      const row = await this.prisma.mediaLink.create({
        data: {
          mediaId: input.mediaId,
          entityType: toPrismaEntityType(input.entityType),
          entityId: input.entityId,
          role: toPrismaRole(input.role),
          sortOrder: input.sortOrder ?? 0,
          isPrimary: input.isPrimary ?? false,
        },
      });
      return mapLink(row);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new AppError({
          errorCode: ErrorCodes.CONFLICT,
          message: 'Liên kết media đã tồn tại',
        });
      }
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2003'
      ) {
        throw new AppError({
          errorCode: ErrorCodes.MEDIA_NOT_FOUND,
          message: 'Không tìm thấy media để liên kết',
        });
      }
      throw error;
    }
  }

  async listLinks(mediaId: string): Promise<MediaLinkRecord[]> {
    const rows = await this.prisma.mediaLink.findMany({
      where: { mediaId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(mapLink);
  }

  async findLinksByEntity(
    entityType: MediaEntityType,
    entityId: string,
  ): Promise<MediaLinkRecord[]> {
    const rows = await this.prisma.mediaLink.findMany({
      where: {
        entityType: toPrismaEntityType(entityType),
        entityId,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(mapLink);
  }

  async clearPrimaryForEntity(
    entityType: MediaEntityType,
    entityId: string,
    role: MediaRole,
  ): Promise<void> {
    await this.prisma.mediaLink.updateMany({
      where: {
        entityType: toPrismaEntityType(entityType),
        entityId,
        role: toPrismaRole(role),
        isPrimary: true,
      },
      data: { isPrimary: false },
    });
  }

  async findOrphans(olderThanHours: number): Promise<MediaRecord[]> {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    const rows = await this.prisma.mediaObject.findMany({
      where: {
        OR: [
          { status: PrismaMediaStatus.DELETED },
          {
            status: PrismaMediaStatus.PENDING,
            createdAt: { lt: cutoff },
          },
        ],
      },
    });
    return rows.map(mapMedia);
  }

  async hardDeleteMetadata(id: string): Promise<void> {
    await this.prisma.mediaLink.deleteMany({ where: { mediaId: id } });
    await this.prisma.mediaObject.delete({ where: { id } });
  }

  async writeAudit(
    entry: Omit<MediaAuditEntry, 'id' | 'createdAt'>,
  ): Promise<void> {
    await this.prisma.mediaAuditLog.create({
      data: {
        mediaId: entry.mediaId ?? null,
        action: entry.action,
        actorId: entry.actorId,
        details: entry.details as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
