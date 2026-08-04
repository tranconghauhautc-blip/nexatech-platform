'use client';

import { Suspense } from 'react';
import { WarrantyPageInner } from './warranty-page-inner';

export default function Page() {
  return (
    <Suspense
      fallback={
        <div
          className="nt-skeleton"
          style={{ minHeight: 160 }}
          role="status"
          aria-busy="true"
        >
          Đang tải bảo hành…
        </div>
      }
    >
      <WarrantyPageInner />
    </Suspense>
  );
}
