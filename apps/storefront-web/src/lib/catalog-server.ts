import { serverApiRequest } from './api-server';
import type {
  Brand,
  CategoryTreeNode,
  PaginatedResponse,
  ProductDetail,
  ProductSearchFacets,
  ProductSearchItem,
  RecommendationItem,
  StockSource,
} from './types';

const EMPTY_PAGE: PaginatedResponse<ProductSearchItem> = {
  items: [],
  meta: { page: 1, pageSize: 20, totalItems: 0, totalPages: 1 },
};

export async function getCategoryTree(): Promise<CategoryTreeNode[]> {
  try {
    return await serverApiRequest<CategoryTreeNode[]>('catalog', '/categories');
  } catch {
    return [];
  }
}

export async function getBrands(): Promise<Brand[]> {
  try {
    return await serverApiRequest<Brand[]>('catalog', '/brands');
  } catch {
    return [];
  }
}

export async function getProductFacets(
  query: ProductListQuery,
): Promise<ProductSearchFacets> {
  try {
    return await serverApiRequest<ProductSearchFacets>(
      'catalog',
      '/products/facets',
      { query: query as Record<string, string | number | undefined> },
    );
  } catch {
    return { brands: [], priceRange: null };
  }
}

export interface ProductListQuery {
  q?: string;
  categorySlug?: string;
  brandSlug?: string;
  minPrice?: number;
  maxPrice?: number;
  attributeKey?: string;
  attributeValue?: string;
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'newest' | 'name';
  page?: number;
  pageSize?: number;
}

export async function searchProducts(
  query: ProductListQuery,
): Promise<PaginatedResponse<ProductSearchItem>> {
  try {
    return await serverApiRequest<PaginatedResponse<ProductSearchItem>>(
      'catalog',
      '/products',
      { query: query as Record<string, string | number | undefined> },
    );
  } catch {
    return EMPTY_PAGE;
  }
}

export async function getProductBySlug(
  slug: string,
): Promise<ProductDetail | null> {
  try {
    return await serverApiRequest<ProductDetail>(
      'catalog',
      `/products/${encodeURIComponent(slug)}`,
    );
  } catch {
    return null;
  }
}

export async function getRecommendations(
  productId: string,
): Promise<RecommendationItem[]> {
  try {
    return await serverApiRequest<RecommendationItem[]>(
      'catalog',
      `/products/${encodeURIComponent(productId)}/recommendations`,
    );
  } catch {
    return [];
  }
}

export async function getStockAvailability(
  skuCode: string,
  quantity = 1,
): Promise<StockSource[]> {
  try {
    return await serverApiRequest<StockSource[]>(
      'inventory',
      '/stock/availability',
      {
        query: { skuCode, quantity },
      },
    );
  } catch {
    return [];
  }
}

export function findCategoryBySlug(
  nodes: CategoryTreeNode[],
  slug: string,
): CategoryTreeNode | null {
  for (const node of nodes) {
    if (node.slug === slug) {
      return node;
    }
    const found = findCategoryBySlug(node.children, slug);
    if (found) {
      return found;
    }
  }
  return null;
}

export function flattenCategories(
  nodes: CategoryTreeNode[],
): CategoryTreeNode[] {
  const result: CategoryTreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    result.push(...flattenCategories(node.children));
  }
  return result;
}

/** Giá thấp nhất trong danh sách SKU còn hàng trên trang chi tiết sản phẩm. */
export function getProductPriceRange(product: ProductDetail): {
  min: number;
  max: number;
  currency: string;
} {
  const prices = product.skus
    .map((sku) => sku.price?.amount)
    .filter((value): value is number => typeof value === 'number');
  if (prices.length === 0) {
    return { min: 0, max: 0, currency: 'VND' };
  }
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    currency: product.skus[0]?.price?.currency ?? 'VND',
  };
}
