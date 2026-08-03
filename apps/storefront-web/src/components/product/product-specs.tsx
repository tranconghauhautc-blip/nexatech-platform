import type { ProductSpecValue } from '../../lib/types';
import styles from './product-specs.module.css';

function specLabel(spec: ProductSpecValue): string {
  if (spec.attributeLabel?.trim()) {
    return spec.unit
      ? `${spec.attributeLabel} (${spec.unit})`
      : spec.attributeLabel;
  }
  if (spec.attributeKey?.trim()) {
    return spec.attributeKey;
  }
  return 'Thông số';
}

function formatSpecValue(spec: ProductSpecValue): string {
  const raw = spec.value?.trim() ?? '';
  if (!raw) {
    return '—';
  }
  if (spec.unit && !raw.toLowerCase().includes(spec.unit.toLowerCase())) {
    return `${raw} ${spec.unit}`;
  }
  return raw;
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
            <th scope="row">{specLabel(spec)}</th>
            <td>{formatSpecValue(spec)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
