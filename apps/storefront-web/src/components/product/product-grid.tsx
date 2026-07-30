import type { ProductSearchItem } from '../../lib/types';
import { EmptyState } from '../common/empty-state';
import { ProductCard } from './product-card';
import styles from './product-grid.module.css';

export function ProductGrid({
  products,
  emptyTitle = 'Chưa có sản phẩm phù hợp',
  emptyDescription = 'Vui lòng thử từ khóa hoặc bộ lọc khác.',
}: {
  products: ProductSearchItem[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (products.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className={styles.grid}>
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
