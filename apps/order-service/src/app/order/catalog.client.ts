import { Logger } from '@nestjs/common';
import { AppError, ErrorCodes } from '@nexatech/shared-errors';
import type { CatalogSkuInfo } from './order.types';

export interface CatalogClient {
  getSkuByCode(skuCode: string): Promise<CatalogSkuInfo | null>;
}

export class InMemoryCatalogClient implements CatalogClient {
  private readonly skus = new Map<string, CatalogSkuInfo>();

  seed(sku: CatalogSkuInfo): void {
    this.skus.set(sku.skuCode, sku);
  }

  clear(): void {
    this.skus.clear();
  }

  async getSkuByCode(skuCode: string): Promise<CatalogSkuInfo | null> {
    return this.skus.get(skuCode) ?? null;
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

  async getSkuByCode(skuCode: string): Promise<CatalogSkuInfo | null> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/api/v1/skus/${encodeURIComponent(skuCode)}`;
    const response = await this.fetchWithRetry(url);
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new AppError({
        errorCode: ErrorCodes.ORDER_CATALOG_UNAVAILABLE,
        message: 'Không thể lấy thông tin SKU từ catalog-service',
        details: { status: response.status, skuCode },
      });
    }
    const body = (await response.json()) as {
      id: string;
      skuCode: string;
      productId: string;
      name: string;
      attributes?: Record<string, string>;
      price?: { amount: number; currency: string };
      product?: {
        id: string;
        name: string;
        status: CatalogSkuInfo['productStatus'];
        /** catalog-service lưu thumbnailUrl là mediaId (không phải URL tuyệt đối). */
        thumbnailUrl?: string;
      };
    };

    const productStatus = body.product?.status ?? 'active';
    const unitPrice = body.price?.amount ?? 0;
    return {
      skuId: body.id,
      skuCode: body.skuCode,
      productId: body.productId,
      productName: body.product?.name ?? body.name,
      productStatus,
      skuName: body.name,
      attributes: body.attributes ?? {},
      unitPrice,
      currency: body.price?.currency ?? 'VND',
      isSellable: productStatus === 'active' && unitPrice > 0,
      imageMediaId: body.product?.thumbnailUrl || undefined,
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
        HttpCatalogClient.logger.warn(
          `catalog fetch attempt ${attempt + 1} failed: ${String(error)}`,
        );
      }
    }
    throw new AppError({
      errorCode: ErrorCodes.ORDER_CATALOG_UNAVAILABLE,
      message: 'Không thể kết nối catalog-service',
      details: { cause: String(lastError) },
    });
  }
}
