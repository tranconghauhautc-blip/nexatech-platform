import type {
  MediaOwnerType as ContractOwnerType,
  MediaRole as ContractRole,
} from '@nexatech/shared-contracts';

export type MediaStatus = 'pending' | 'active' | 'deleted';
export type MediaOwnerType = ContractOwnerType;
export type MediaRole = ContractRole;
export type MediaEntityType = 'product' | 'sku' | 'review';

export interface MediaRecord {
  id: string;
  bucket: string;
  objectKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: MediaStatus;
  ownerType: MediaOwnerType;
  ownerId: string;
  uploadedBy: string;
  etag?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface MediaLinkRecord {
  id: string;
  mediaId: string;
  entityType: MediaEntityType;
  entityId: string;
  role: MediaRole;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: Date;
}

export interface CreatePendingMediaInput {
  bucket: string;
  objectKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  ownerType: MediaOwnerType;
  ownerId: string;
  uploadedBy: string;
}

export interface CreateMediaLinkInput {
  mediaId: string;
  entityType: MediaEntityType;
  entityId: string;
  role: MediaRole;
  sortOrder?: number;
  isPrimary?: boolean;
}

export interface MediaAuditEntry {
  id: string;
  mediaId?: string;
  action: string;
  actorId: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

export interface PresignUploadResult {
  mediaId: string;
  uploadUrl: string;
  objectKey: string;
  bucket: string;
  expiresIn: number;
  contentType: string;
}

export interface DownloadUrlResult {
  downloadUrl: string;
  expiresIn: number;
}

export interface MediaActor {
  userId: string;
  roles: import('@nexatech/shared-auth').Role[];
}

export const PUBLIC_OWNER_TYPES: readonly MediaOwnerType[] = [
  'product',
  'sku',
  'review',
];
