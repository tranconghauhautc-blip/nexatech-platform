import { createId } from '@nexatech/shared-platform';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type {
  CreateMediaLinkInput,
  CreatePendingMediaInput,
  MediaAuditEntry,
  MediaEntityType,
  MediaLinkRecord,
  MediaOwnerType,
  MediaRecord,
  MediaRole,
} from './media.types';

export const MEDIA_REPOSITORY = Symbol('MEDIA_REPOSITORY');

export interface MediaRepository {
  createPending(input: CreatePendingMediaInput): Promise<MediaRecord>;
  findById(id: string): Promise<MediaRecord | null>;
  markActive(id: string, etag?: string): Promise<MediaRecord>;
  softDelete(id: string): Promise<MediaRecord>;
  listByOwner(
    ownerType: MediaOwnerType,
    ownerId: string,
  ): Promise<MediaRecord[]>;
  createLink(input: CreateMediaLinkInput): Promise<MediaLinkRecord>;
  listLinks(mediaId: string): Promise<MediaLinkRecord[]>;
  findLinksByEntity(
    entityType: MediaEntityType,
    entityId: string,
  ): Promise<MediaLinkRecord[]>;
  clearPrimaryForEntity(
    entityType: MediaEntityType,
    entityId: string,
    role: MediaRole,
  ): Promise<void>;
  findOrphans(olderThanHours: number): Promise<MediaRecord[]>;
  hardDeleteMetadata(id: string): Promise<void>;
  writeAudit(entry: Omit<MediaAuditEntry, 'id' | 'createdAt'>): Promise<void>;
}

export class InMemoryMediaRepository implements MediaRepository {
  private readonly media = new Map<string, MediaRecord>();
  private readonly links = new Map<string, MediaLinkRecord>();
  readonly auditLogs: MediaAuditEntry[] = [];

  async createPending(input: CreatePendingMediaInput): Promise<MediaRecord> {
    const duplicate = [...this.media.values()].find(
      (item) =>
        item.bucket === input.bucket && item.objectKey === input.objectKey,
    );
    if (duplicate) {
      throw new AppError({
        errorCode: ErrorCodes.CONFLICT,
        message: 'Object key media đã tồn tại',
        details: { objectKey: input.objectKey },
      });
    }

    const now = new Date();
    const record: MediaRecord = {
      id: createId(),
      bucket: input.bucket,
      objectKey: input.objectKey,
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      status: 'pending',
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      uploadedBy: input.uploadedBy,
      createdAt: now,
      updatedAt: now,
    };
    this.media.set(record.id, record);
    return record;
  }

  async findById(id: string): Promise<MediaRecord | null> {
    const record = this.media.get(id);
    return record ? { ...record } : null;
  }

  async markActive(id: string, etag?: string): Promise<MediaRecord> {
    const current = this.media.get(id);
    if (!current) {
      throw new AppError({
        errorCode: ErrorCodes.MEDIA_NOT_FOUND,
        message: 'Không tìm thấy media',
      });
    }
    const updated: MediaRecord = {
      ...current,
      status: 'active',
      etag: etag ?? current.etag,
      updatedAt: new Date(),
    };
    this.media.set(id, updated);
    return { ...updated };
  }

  async softDelete(id: string): Promise<MediaRecord> {
    const current = this.media.get(id);
    if (!current) {
      throw new AppError({
        errorCode: ErrorCodes.MEDIA_NOT_FOUND,
        message: 'Không tìm thấy media',
      });
    }
    const now = new Date();
    const updated: MediaRecord = {
      ...current,
      status: 'deleted',
      deletedAt: now,
      updatedAt: now,
    };
    this.media.set(id, updated);
    return { ...updated };
  }

  async listByOwner(
    ownerType: MediaOwnerType,
    ownerId: string,
  ): Promise<MediaRecord[]> {
    return [...this.media.values()]
      .filter(
        (item) =>
          item.ownerType === ownerType &&
          item.ownerId === ownerId &&
          item.status !== 'deleted',
      )
      .map((item) => ({ ...item }));
  }

  async createLink(input: CreateMediaLinkInput): Promise<MediaLinkRecord> {
    if (!this.media.has(input.mediaId)) {
      throw new AppError({
        errorCode: ErrorCodes.MEDIA_NOT_FOUND,
        message: 'Không tìm thấy media để liên kết',
      });
    }

    const duplicate = [...this.links.values()].find(
      (link) =>
        link.mediaId === input.mediaId &&
        link.entityType === input.entityType &&
        link.entityId === input.entityId,
    );
    if (duplicate) {
      throw new AppError({
        errorCode: ErrorCodes.CONFLICT,
        message: 'Liên kết media đã tồn tại',
      });
    }

    const link: MediaLinkRecord = {
      id: createId(),
      mediaId: input.mediaId,
      entityType: input.entityType,
      entityId: input.entityId,
      role: input.role,
      sortOrder: input.sortOrder ?? 0,
      isPrimary: input.isPrimary ?? false,
      createdAt: new Date(),
    };
    this.links.set(link.id, link);
    return { ...link };
  }

  async listLinks(mediaId: string): Promise<MediaLinkRecord[]> {
    return [...this.links.values()]
      .filter((link) => link.mediaId === mediaId)
      .map((link) => ({ ...link }));
  }

  async findLinksByEntity(
    entityType: MediaEntityType,
    entityId: string,
  ): Promise<MediaLinkRecord[]> {
    return [...this.links.values()]
      .filter(
        (link) => link.entityType === entityType && link.entityId === entityId,
      )
      .map((link) => ({ ...link }));
  }

  async clearPrimaryForEntity(
    entityType: MediaEntityType,
    entityId: string,
    role: MediaRole,
  ): Promise<void> {
    for (const [id, link] of this.links.entries()) {
      if (
        link.entityType === entityType &&
        link.entityId === entityId &&
        link.role === role &&
        link.isPrimary
      ) {
        this.links.set(id, { ...link, isPrimary: false });
      }
    }
  }

  async findOrphans(olderThanHours: number): Promise<MediaRecord[]> {
    const cutoff = Date.now() - olderThanHours * 60 * 60 * 1000;
    return [...this.media.values()]
      .filter((item) => {
        if (item.status === 'deleted') {
          return true;
        }
        if (item.status === 'pending' && item.createdAt.getTime() < cutoff) {
          return true;
        }
        return false;
      })
      .map((item) => ({ ...item }));
  }

  async hardDeleteMetadata(id: string): Promise<void> {
    this.media.delete(id);
    for (const [linkId, link] of this.links.entries()) {
      if (link.mediaId === id) {
        this.links.delete(linkId);
      }
    }
  }

  async writeAudit(
    entry: Omit<MediaAuditEntry, 'id' | 'createdAt'>,
  ): Promise<void> {
    this.auditLogs.push({
      id: createId(),
      ...entry,
      createdAt: new Date(),
    });
  }
}
