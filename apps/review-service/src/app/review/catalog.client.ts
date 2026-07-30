import { Logger } from '@nestjs/common';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { CatalogProductSnapshot } from './review.types';

export interface CatalogClient {
  getProduct(productId: string): Promise<CatalogProductSnapshot | null>;
}

export class InMemoryCatalogClient implements CatalogClient {
  private products = new Map<string, CatalogProductSnapshot>();

  seed(product: CatalogProductSnapshot): void {
    this.products.set(product.id, { ...product });
  }

  clear(): void {
    this.products.clear();
  }

  async getProduct(productId: string): Promise<CatalogProductSnapshot | null> {
    return this.products.get(productId) ?? null;
  }
}

export class HttpCatalogClient implements CatalogClient {
  private static readonly logger = new Logger(HttpCatalogClient.name);

  constructor(
    private readonly baseUrl: string,
    private readonly timeoutMs = Number(
      process.env['CATALOG_HTTP_TIMEOUT_MS'] ?? 3000,
    ),
    private readonly retries = Number(process.env['CATALOG_HTTP_RETRIES'] ?? 2),
  ) {}

  async getProduct(productId: string): Promise<CatalogProductSnapshot | null> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/api/v1/products/${encodeURIComponent(productId)}`;
    const response = await this.fetchWithRetry(url);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new AppError({
        errorCode: ErrorCodes.REVIEW_CATALOG_UNAVAILABLE,
        message: 'Không thể lấy thông tin sản phẩm từ catalog-service',
        details: { status: response.status, productId },
      });
    }
    const body = (await response.json()) as {
      id: string;
      name: string;
      status: string;
    };
    return { id: body.id, name: body.name, status: body.status };
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
        HttpCatalogClient.logger.warn(
          `catalog fetch attempt ${attempt + 1} failed: ${String(error)}`,
        );
      }
    }
    throw new AppError({
      errorCode: ErrorCodes.REVIEW_CATALOG_UNAVAILABLE,
      message: 'Không thể kết nối catalog-service',
      details: { cause: String(lastError) },
    });
  }
}
