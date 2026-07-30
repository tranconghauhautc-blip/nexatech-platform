'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DashboardSummaryDto } from '@nexatech/shared-contracts';
import { bffRequest, getErrorMessage } from '../../../lib/api-client';
import { DashboardMetrics } from '../../../components/dashboard/DashboardMetrics';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummaryDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    bffRequest<DashboardSummaryDto>('reporting', 'admin/reporting/dashboard')
      .then(setData)
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => load(), [load]);

  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Bảng điều khiển</div>
          <div className="nx-page-subtitle">
            Tổng quan hoạt động kinh doanh NexaTech theo thời gian thực
          </div>
        </div>
      </div>
      <DashboardMetrics
        data={data}
        loading={loading}
        error={error}
        onRetry={load}
      />
    </div>
  );
}
