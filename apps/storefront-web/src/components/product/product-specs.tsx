import type { ProductSpecValue } from '../../lib/types';
import styles from './product-specs.module.css';

function humanizeAttributeId(id: string): string {
  const withoutPrefix = id.length > 12 ? id.slice(0, 8) : id;
  return withoutPrefix
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ProductSpecs({
  specValues,
}: {
  specValues: ProductSpecValue[];
}) {
  if (specValues.length === 0) {
    return (
      <p className="nt-muted">
        Sản phẩm chưa cập nhật thông số kỹ thuật chi tiết.
      </p>
    );
  }

  return (
    <table className={styles.table}>
      <tbody>
        {specValues.map((spec) => (
          <tr key={spec.id}>
            <th scope="row">{humanizeAttributeId(spec.attributeId)}</th>
            <td>{spec.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
