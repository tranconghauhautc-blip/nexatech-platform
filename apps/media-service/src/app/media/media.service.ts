import {
  hasMinimumRole,
  isRole,
  Roles,
  type Role,
} from '@nexatech/shared-auth';
import {
  ALLOWED_MEDIA_MIME_TYPES,
  mediaPresignRequestSchema,
  type ConfirmMediaUpload,
  type LinkMediaRequest,
  type MediaPresignRequest,
} from '@nexatech/shared-contracts';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import {
  createEventEnvelope,
  EventTypes,
  type EventEnvelope,
} from '@nexatech/shared-events';
import { createId, createTraceId } from '@nexatech/shared-platform';
import { Injectable } from '@nestjs/common';
import type { ObjectStorage } from './object-storage';
import type { MediaRepository } from './media.repository';
import {
  PUBLIC_OWNER_TYPES,
  type DownloadUrlResult,
  type MediaActor,
  type MediaRecord,
  type PresignUploadResult,
} from './media.types';

export const auditEvents: EventEnvelope[] = [];

const DEFAULT_PRESIGN_EXPIRES_SECONDS = 3600;
const DEFAULT_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

@Injectable()
export class MediaService {
  constructor(
    private readonly repository: MediaRepository,
    private readonly storage: ObjectStorage,
  ) {}

  private maxUploadBytes(): number {
    const configured = process.env['MEDIA_MAX_UPLOAD_BYTES'];
    if (configured) {
      const parsed = Number(configured);
      if (Number.isFinite(parsed) && parsed > 0) {
        return parsed;
      }
    }
    return DEFAULT_MAX_UPLOAD_BYTES;
  }

  private defaultBucket(requested?: string): string {
    return requested ?? process.env['MINIO_BUCKET_PRODUCT'] ?? 'product-media';
  }

  private recordAudit(event: EventEnvelope): void {
    auditEvents.push(event);
  }

  private requireStaff(roles: Role[]): void {
    if (!hasMinimumRole(roles, Roles.Staff)) {
      throw new AppError({
        errorCode: ErrorCodes.MEDIA_FORBIDDEN,
        message: 'Bạn không có quyền thực hiện thao tác này',
      });
    }
  }

  private requireManager(roles: Role[]): void {
    if (!hasMinimumRole(roles, Roles.Manager)) {
      throw new AppError({
        errorCode: ErrorCodes.MEDIA_FORBIDDEN,
        message: 'Yêu cầu quyền Manager trở lên',
      });
    }
  }

  private isOwnerOrStaff(media: MediaRecord, actor: MediaActor): boolean {
    if (media.uploadedBy === actor.userId) {
      return true;
    }
    return hasMinimumRole(actor.roles, Roles.Staff);
  }

  private canDownload(media: MediaRecord, actor: MediaActor): boolean {
    if (this.isOwnerOrStaff(media, actor)) {
      return true;
    }
    if (
      media.status === 'active' &&
      PUBLIC_OWNER_TYPES.includes(media.ownerType)
    ) {
      return true;
    }
    return false;
  }

  private async getMediaOrThrow(id: string): Promise<MediaRecord> {
    const media = await this.repository.findById(id);
    if (!media || media.status === 'deleted') {
      throw new AppError({
        errorCode: ErrorCodes.MEDIA_NOT_FOUND,
        message: 'Không tìm thấy media',
      });
    }
    return media;
  }

  private sanitizeFileName(fileName: string): string {
    const sanitized = fileName
      .replace(/[/\\]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 200);
    return sanitized.length > 0 ? sanitized : 'file';
  }

  private buildObjectKey(
    ownerType: string,
    ownerId: string,
    fileName: string,
  ): string {
    return `${ownerType}/${ownerId}/${createId()}-${this.sanitizeFileName(fileName)}`;
  }

  async presignUpload(
    input: MediaPresignRequest,
    actor: MediaActor,
  ): Promise<PresignUploadResult> {
    const parsedResult = mediaPresignRequestSchema.safeParse(input);
    if (!parsedResult.success) {
      for (const issue of parsedResult.error.issues) {
        if (issue.path[0] === 'contentType') {
          throw new AppError({
            errorCode: ErrorCodes.MEDIA_INVALID_TYPE,
            message: 'Loại file không được hỗ trợ',
            details: { contentType: input.contentType },
          });
        }
        if (issue.path[0] === 'sizeBytes') {
          throw new AppError({
            errorCode: ErrorCodes.MEDIA_TOO_LARGE,
            message: 'Kích thước file vượt quá giới hạn cho phép',
            details: {
              sizeBytes: input.sizeBytes,
              maxBytes: this.maxUploadBytes(),
            },
          });
        }
      }
      throw new AppError({
        errorCode: ErrorCodes.VALIDATION_FAILED,
        message: 'Dữ liệu presign không hợp lệ',
        details: { issues: parsedResult.error.issues },
      });
    }
    const parsed = parsedResult.data;
    if (!actor.userId) {
      throw new AppError({
        errorCode: ErrorCodes.UNAUTHORIZED,
        message: 'Thiếu thông tin người dùng',
      });
    }

    if (
      !(ALLOWED_MEDIA_MIME_TYPES as readonly string[]).includes(
        parsed.contentType,
      )
    ) {
      throw new AppError({
        errorCode: ErrorCodes.MEDIA_INVALID_TYPE,
        message: 'Loại file không được hỗ trợ',
        details: { contentType: parsed.contentType },
      });
    }

    if (parsed.sizeBytes > this.maxUploadBytes()) {
      throw new AppError({
        errorCode: ErrorCodes.MEDIA_TOO_LARGE,
        message: 'Kích thước file vượt quá giới hạn cho phép',
        details: {
          sizeBytes: parsed.sizeBytes,
          maxBytes: this.maxUploadBytes(),
        },
      });
    }

    const bucket = this.defaultBucket(parsed.bucket);
    const objectKey = this.buildObjectKey(
      parsed.ownerType,
      parsed.ownerId,
      parsed.fileName,
    );
    const expiresIn = DEFAULT_PRESIGN_EXPIRES_SECONDS;

    await this.storage.ensureBucket(bucket);

    const media = await this.repository.createPending({
      bucket,
      objectKey,
      fileName: parsed.fileName,
      contentType: parsed.contentType,
      sizeBytes: parsed.sizeBytes,
      ownerType: parsed.ownerType,
      ownerId: parsed.ownerId,
      uploadedBy: actor.userId,
    });

    const uploadUrl = await this.storage.createPresignedPutUrl({
      bucket,
      objectKey,
      contentType: parsed.contentType,
      expiresSeconds: expiresIn,
    });

    await this.repository.writeAudit({
      mediaId: media.id,
      action: 'presign',
      actorId: actor.userId,
      details: { objectKey, bucket },
    });

    return {
      mediaId: media.id,
      uploadUrl,
      objectKey,
      bucket,
      expiresIn,
    };
  }

  async confirmUpload(
    mediaId: string,
    input: ConfirmMediaUpload,
    actor: MediaActor,
  ): Promise<MediaRecord> {
    const media = await this.getMediaOrThrow(mediaId);
    if (media.status !== 'pending') {
      throw new AppError({
        errorCode: ErrorCodes.BAD_REQUEST,
        message: 'Media không ở trạng thái chờ xác nhận',
      });
    }
    if (!this.isOwnerOrStaff(media, actor)) {
      throw new AppError({
        errorCode: ErrorCodes.MEDIA_FORBIDDEN,
        message: 'Bạn không có quyền xác nhận upload này',
      });
    }

    const exists = await this.storage.objectExists({
      bucket: media.bucket,
      objectKey: media.objectKey,
    });
    if (!exists) {
      throw new AppError({
        errorCode: ErrorCodes.BAD_REQUEST,
        message: 'Chưa tìm thấy file trên storage, vui lòng upload trước',
      });
    }

    const updated = await this.repository.markActive(mediaId, input.etag);

    await this.repository.writeAudit({
      mediaId,
      action: 'confirm',
      actorId: actor.userId,
      details: { etag: input.etag },
    });

    this.recordAudit(
      createEventEnvelope({
        eventType: EventTypes.MEDIA_UPLOADED,
        producer: 'media-service',
        traceId: createTraceId(),
        payload: {
          mediaId,
          ownerType: updated.ownerType,
          ownerId: updated.ownerId,
          bucket: updated.bucket,
          objectKey: updated.objectKey,
        },
      }),
    );

    this.recordAudit(
      createEventEnvelope({
        eventType: EventTypes.AUDIT_RECORDED,
        producer: 'media-service',
        traceId: createTraceId(),
        payload: {
          mediaId,
          action: 'media.confirm',
          actorId: actor.userId,
        },
      }),
    );

    return updated;
  }

  async getMetadata(mediaId: string): Promise<MediaRecord> {
    return this.getMediaOrThrow(mediaId);
  }

  async getDownloadUrl(
    mediaId: string,
    actor: MediaActor,
  ): Promise<DownloadUrlResult> {
    const media = await this.getMediaOrThrow(mediaId);
    if (!this.canDownload(media, actor)) {
      throw new AppError({
        errorCode: ErrorCodes.MEDIA_FORBIDDEN,
        message: 'Bạn không có quyền tải media này',
      });
    }

    const expiresIn = DEFAULT_PRESIGN_EXPIRES_SECONDS;
    const downloadUrl = await this.storage.createPresignedGetUrl({
      bucket: media.bucket,
      objectKey: media.objectKey,
      expiresSeconds: expiresIn,
    });

    return { downloadUrl, expiresIn };
  }

  async deleteMedia(mediaId: string, actor: MediaActor): Promise<MediaRecord> {
    const media = await this.getMediaOrThrow(mediaId);
    if (!this.isOwnerOrStaff(media, actor)) {
      throw new AppError({
        errorCode: ErrorCodes.MEDIA_FORBIDDEN,
        message: 'Bạn không có quyền xóa media này',
      });
    }

    const deleted = await this.repository.softDelete(mediaId);

    try {
      await this.storage.removeObject({
        bucket: media.bucket,
        objectKey: media.objectKey,
      });
    } catch {
      // metadata đã soft delete; storage cleanup có thể retry sau
    }

    await this.repository.writeAudit({
      mediaId,
      action: 'delete',
      actorId: actor.userId,
    });

    this.recordAudit(
      createEventEnvelope({
        eventType: EventTypes.MEDIA_DELETED,
        producer: 'media-service',
        traceId: createTraceId(),
        payload: { mediaId },
      }),
    );

    return deleted;
  }

  async linkMedia(
    mediaId: string,
    input: LinkMediaRequest,
    actor: MediaActor,
  ): Promise<{ mediaId: string; linkId: string }> {
    this.requireStaff(actor.roles);
    if (input.entityType === 'product' || input.entityType === 'sku') {
      this.requireStaff(actor.roles);
    }

    const media = await this.getMediaOrThrow(mediaId);
    if (media.status !== 'active') {
      throw new AppError({
        errorCode: ErrorCodes.BAD_REQUEST,
        message: 'Chỉ liên kết media đã active',
      });
    }

    if (input.isPrimary) {
      await this.repository.clearPrimaryForEntity(
        input.entityType,
        input.entityId,
        input.role,
      );
    }

    const link = await this.repository.createLink({
      mediaId,
      entityType: input.entityType,
      entityId: input.entityId,
      role: input.role,
      sortOrder: input.sortOrder,
      isPrimary: input.isPrimary,
    });

    await this.repository.writeAudit({
      mediaId,
      action: 'link',
      actorId: actor.userId,
      details: {
        entityType: input.entityType,
        entityId: input.entityId,
        role: input.role,
      },
    });

    return { mediaId, linkId: link.id };
  }

  async listByEntity(entityType: string, entityId: string) {
    const links = await this.repository.findLinksByEntity(
      entityType as LinkMediaRequest['entityType'],
      entityId,
    );
    const mediaItems = await Promise.all(
      links.map(async (link) => {
        const media = await this.repository.findById(link.mediaId);
        return media && media.status !== 'deleted' ? { link, media } : null;
      }),
    );
    return mediaItems.filter(
      (item): item is { link: (typeof links)[number]; media: MediaRecord } =>
        item !== null,
    );
  }

  async cleanupOrphans(
    olderThanHours = 24,
    actor: MediaActor,
  ): Promise<{ removed: number; mediaIds: string[] }> {
    this.requireManager(actor.roles);

    const orphans = await this.repository.findOrphans(olderThanHours);
    const mediaIds: string[] = [];

    for (const orphan of orphans) {
      try {
        await this.storage.removeObject({
          bucket: orphan.bucket,
          objectKey: orphan.objectKey,
        });
      } catch {
        // tiếp tục xóa metadata
      }
      await this.repository.hardDeleteMetadata(orphan.id);
      mediaIds.push(orphan.id);

      await this.repository.writeAudit({
        mediaId: orphan.id,
        action: 'cleanup_orphan',
        actorId: actor.userId,
        details: { status: orphan.status },
      });
    }

    return { removed: mediaIds.length, mediaIds };
  }
}

export function parseRolesHeader(value?: string): Role[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((role) => role.trim())
    .filter(isRole);
}

export function parseActor(
  userId: string | undefined,
  rolesHeader: string | undefined,
): MediaActor {
  return {
    userId: userId ?? '',
    roles: parseRolesHeader(rolesHeader),
  };
}
