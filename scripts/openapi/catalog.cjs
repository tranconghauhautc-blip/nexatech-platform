/**
 * Canonical local service catalog (ports from docker-compose.apps.yml).
 * Keep in sync with infra/docker/docker-compose.apps.yml and docs/SWAGGER-LINKS.md.
 */
'use strict';

/** @typedef {{ id: string, title: string, description: string, port: number, auth: string, roles: string, scenarios: string }} ServiceEntry */

/** @type {ServiceEntry[]} */
const SERVICES = [
  {
    id: 'identity-service',
    title: 'NexaTech Identity Service',
    description: 'Auth, session, OTP và RBAC',
    port: 3001,
    auth: 'Public login + Bearer JWT for protected',
    roles: 'Public / Auth / Staff+',
    scenarios: 'SC-21, SC-24, SC-60, SC-64, SC-65, SC-67, SC-59',
  },
  {
    id: 'customer-service',
    title: 'NexaTech Customer Service',
    description: 'Hồ sơ khách hàng và địa chỉ',
    port: 3002,
    auth: 'Bearer / x-user-id',
    roles: 'Customer / Staff+',
    scenarios: '—',
  },
  {
    id: 'catalog-service',
    title: 'NexaTech Catalog Service',
    description: 'Danh mục, thương hiệu, sản phẩm, SKU và giá',
    port: 3003,
    auth: 'Public read + admin headers',
    roles: 'Public / Manager+',
    scenarios: 'SC-63',
  },
  {
    id: 'media-service',
    title: 'NexaTech Media Service',
    description: 'Presign MinIO và metadata media',
    port: 3004,
    auth: 'Bearer / x-user-id',
    roles: 'Owner / Staff+',
    scenarios: 'SC-36',
  },
  {
    id: 'inventory-service',
    title: 'NexaTech Inventory Service',
    description: 'Kho, cửa hàng, tồn, giữ và điều chuyển',
    port: 3005,
    auth: 'x-user-id / x-user-roles',
    roles: 'Staff+',
    scenarios: '—',
  },
  {
    id: 'cart-service',
    title: 'NexaTech Cart Service',
    description: 'Giỏ hàng, wishlist, so sánh, đã xem',
    port: 3006,
    auth: 'x-user-id / x-cart-token',
    roles: 'Guest / Customer',
    scenarios: '—',
  },
  {
    id: 'order-service',
    title: 'NexaTech Order Service',
    description: 'Checkout, trạng thái đơn, huỷ và outbox',
    port: 3007,
    auth: 'x-user-id / x-user-roles',
    roles: 'Customer / Staff+',
    scenarios: 'SC-01, SC-02, SC-12, SC-58',
  },
  {
    id: 'payment-service',
    title: 'NexaTech Payment Service',
    description: 'COD, mock, VNPay sandbox và hoàn tiền',
    port: 3008,
    auth: 'x-user-id / webhook signatures',
    roles: 'Customer / Staff+ / Provider',
    scenarios: 'SC-03, SC-17, SC-18, SC-20',
  },
  {
    id: 'shipping-service',
    title: 'NexaTech Shipping Service',
    description: 'Báo giá, shipment và webhook vận chuyển',
    port: 3009,
    auth: 'x-user-id / provider webhook',
    roles: 'Customer / Staff+ / Provider',
    scenarios: 'SC-04, SC-61, SC-66',
  },
  {
    id: 'review-service',
    title: 'NexaTech Review Service',
    description: 'Đánh giá sản phẩm và kiểm duyệt',
    port: 3010,
    auth: 'x-user-id / x-user-roles',
    roles: 'Customer / Staff+',
    scenarios: 'SC-05',
  },
  {
    id: 'warranty-service',
    title: 'NexaTech Warranty Service',
    description: 'Bảo hành, đổi trả và đồng bộ đơn',
    port: 3011,
    auth: 'x-user-id / x-user-roles',
    roles: 'Customer / Staff+',
    scenarios: 'SC-06',
  },
  {
    id: 'support-service',
    title: 'NexaTech Support Service',
    description: 'Ticket hỗ trợ và hội thoại',
    port: 3012,
    auth: 'x-user-id / x-user-roles',
    roles: 'Customer / Staff+',
    scenarios: 'SC-07',
  },
  {
    id: 'notification-service',
    title: 'NexaTech Notification Service',
    description: 'Thông báo in-app và email',
    port: 3013,
    auth: 'x-user-id / x-user-roles',
    roles: 'Customer / Manager+',
    scenarios: '—',
  },
  {
    id: 'reporting-service',
    title: 'NexaTech Reporting Service',
    description: 'Dashboard và audit projection',
    port: 3014,
    auth: 'x-user-roles (Manager+)',
    roles: 'Manager / Admin / SuperAdmin',
    scenarios: '—',
  },
];

const KONG_URL = 'http://localhost:8000';
const OPENAPI_DIR_NAME = 'openapi';

module.exports = {
  SERVICES,
  KONG_URL,
  OPENAPI_DIR_NAME,
};
