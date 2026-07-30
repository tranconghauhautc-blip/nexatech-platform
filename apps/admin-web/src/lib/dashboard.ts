import type { DashboardSummaryDto } from '@nexatech/shared-contracts';

/** Coi dashboard là "trống" khi chưa ghi nhận hoạt động nào ở mọi mảng nghiệp vụ. */
export function isDashboardEmpty(
  data: DashboardSummaryDto | null | undefined,
): boolean {
  if (!data) {
    return true;
  }
  return (
    data.totalOrders === 0 &&
    data.totalPayments === 0 &&
    data.totalShipments === 0 &&
    data.totalReviews === 0 &&
    data.totalWarrantyClaims === 0 &&
    data.totalWarrantyReturns === 0 &&
    data.totalSupportTickets === 0
  );
}
