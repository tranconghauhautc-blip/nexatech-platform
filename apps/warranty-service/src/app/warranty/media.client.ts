import { Logger } from '@nestjs/common';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { MediaSnapshot } from './warranty.types';

export interface MediaClient {
  getMedia(mediaId: string): Promise<MediaSnapshot | null>;
}

export class InMemoryMediaClient implements MediaClient {
  private media = new Map<string, MediaSnapshot>();

  seed(item: MediaSnapshot): void {
    this.media.set(item.id, { ...item });
  }

  clear(): void {
    this.media.clear();
  }

  async getMedia(mediaId: string): Promise<MediaSnapshot | null> {
    return this.media.get(mediaId) ?? null;
  }
}

export class HttpMediaClient implements MediaClient {
  private static readonly logger = new Logger(HttpMediaClient.name);

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = Number(
      process.env['MEDIA_HTTP_TIMEOUT_MS'] ?? 3000,
    ),
    private readonly retries = Number(process.env['MEDIA_HTTP_RETRIES'] ?? 2),
  ) {}

  async getMedia(mediaId: string): Promise<MediaSnapshot | null> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/api/v1/media/${encodeURIComponent(mediaId)}`;
    const response = await this.fetchWithRetry(url);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new AppError({
        errorCode: ErrorCodes.WARRANTY_MEDIA_UNAVAILABLE,
        message: 'Không thể lấy metadata media',
        details: { status: response.status, mediaId },
      });
    }
    const body = (await response.json()) as {
      id: string;
      uploadedBy?: string;
      ownerId?: string;
      mimeType: string;
      status: string;
      sizeBytes?: number;
    };
    return {
      id: body.id,
      uploadedBy: body.uploadedBy ?? body.ownerId ?? '',
      mimeType: body.mimeType,
      status: body.status,
      sizeBytes: body.sizeBytes,
    };
  }

  private async fetchWithRetry(url: string): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (response.status >= 500 && attempt < this.retries) {
          continue;
        }
        return response;
      } catch (error) {
        clearTimeout(timer);
        lastError = error;
        HttpMediaClient.logger.warn(
          `media fetch attempt ${attempt + 1} failed: ${String(error)}`,
        );
      }
    }
    throw new AppError({
      errorCode: ErrorCodes.WARRANTY_MEDIA_UNAVAILABLE,
      message: 'Không thể kết nối media-service',
      details: { cause: String(lastError) },
    });
  }
}
