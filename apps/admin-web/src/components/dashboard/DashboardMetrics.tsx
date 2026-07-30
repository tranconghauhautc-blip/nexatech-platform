import type { DashboardSummaryDto } from '@nexatech/shared-contracts';
import { formatNumberVn, formatVnd } from '@nexatech/shared-web';
import { EmptyState, ErrorState, LoadingState } from '../ui/states';
import { Badge } from '../ui/Badge';
import { isDashboardEmpty } from '../../lib/dashboard';

function StatusBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  const entries = Object.entries(breakdown);
  if (entries.length === 0) {
    return null;
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
      {entries.map(([status, count]) => (
        <Badge key={status} tone="neutral">
          {status}: {formatNumberVn(count)}
        </Badge>
      ))}
    </div>
  );
}

function MetricCard({
  label,
  value,
  breakdown,
}: {
  label: string;
  value: number;
  breakdown?: Record<string, number>;
}) {
  return (
    <div className="nx-metric-card">
      <div className="nx-metric-label">{label}</div>
      <div className="nx-metric-value">{formatNumberVn(value)}</div>
      {breakdown ? <StatusBreakdown breakdown={breakdown} /> : null}
    </div>
  );
}

export interface DashboardMetricsProps {
  data: DashboardSummaryDto | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function DashboardMetrics({
  data,
  loading,
  error,
  onRetry,
}: DashboardMetricsProps) {
  if (loading) {
    return <LoadingState label="Đang tải số liệu tổng quan" />;
  }

  if (error) {
    return (
      <ErrorState
        title="Không thể tải số liệu báo cáo"
        description={error}
        onRetry={onRetry}
      />
    );
  }

  if (isDashboardEmpty(data)) {
    return (
      <EmptyState
        title="Chưa có dữ liệu vận hành"
        description="Hệ thống chưa ghi nhận đơn hàng, thanh toán hoặc hoạt động nào. Số liệu sẽ hiển thị khi có phát sinh giao dịch."
      />
    );
  }

  const summary = data as DashboardSummaryDto;

  return (
    <div className="nx-page" style={{ gap: 20 }}>
      <div className="nx-metric-grid">
        <MetricCard
          label="Tổng đơn hàng"
          value={summary.totalOrders}
          breakdown={summary.ordersByStatus}
        />
        <MetricCard
          label="Thanh toán"
          value={summary.totalPayments}
          breakdown={summary.paymentsByStatus}
        />
        <MetricCard
          label="Vận chuyển"
          value={summary.totalShipments}
          breakdown={summary.shipmentsByStatus}
        />
        <MetricCard
          label="Đánh giá"
          value={summary.totalReviews}
          breakdown={summary.reviewsByStatus}
        />
        <MetricCard
          label="Yêu cầu bảo hành"
          value={summary.totalWarrantyClaims}
          breakdown={summary.warrantyClaimsByStatus}
        />
        <MetricCard
          label="Yêu cầu đổi trả"
          value={summary.totalWarrantyReturns}
          breakdown={summary.warrantyReturnsByStatus}
        />
        <MetricCard
          label="Ticket hỗ trợ"
          value={summary.totalSupportTickets}
          breakdown={summary.supportTicketsByStatus}
        />
      </div>
      <div className="nx-card" style={{ maxWidth: 320 }}>
        <div className="nx-metric-label">Tổng doanh thu ghi nhận</div>
        <div
          className="nx-metric-value"
          style={{ color: 'var(--nx-cyan-400)' }}
        >
          {formatVnd(summary.totalRevenue)}
        </div>
        <div className="nx-metric-sub">
          Cập nhật lúc {new Date(summary.generatedAt).toLocaleString('vi-VN')}
        </div>
      </div>
    </div>
  );
}
