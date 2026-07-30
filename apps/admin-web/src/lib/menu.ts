import { Roles, hasMinimumRole, type Role } from '@nexatech/shared-auth';

export interface AdminMenuItem {
  key: string;
  label: string;
  href: string;
  minimumRole: Role;
  /** Nhóm hiển thị trên sidebar. */
  group: 'chinh' | 'san-pham' | 'van-hanh' | 'cham-soc' | 'he-thong';
}

/**
 * Toàn bộ mục menu admin kèm vai trò tối thiểu cần thiết để hiển thị.
 * Đây chỉ là gợi ý UX — backend luôn là nguồn xác thực quyền cuối cùng.
 */
export const ADMIN_MENU_ITEMS: AdminMenuItem[] = [
  {
    key: 'dashboard',
    label: 'Bảng điều khiển',
    href: '/bang-dieu-khien',
    minimumRole: Roles.Staff,
    group: 'chinh',
  },

  {
    key: 'products',
    label: 'Sản phẩm',
    href: '/san-pham',
    minimumRole: Roles.Manager,
    group: 'san-pham',
  },
  {
    key: 'categories',
    label: 'Danh mục',
    href: '/danh-muc',
    minimumRole: Roles.Manager,
    group: 'san-pham',
  },
  {
    key: 'brands',
    label: 'Thương hiệu',
    href: '/thuong-hieu',
    minimumRole: Roles.Manager,
    group: 'san-pham',
  },
  {
    key: 'specs',
    label: 'Thông số',
    href: '/thong-so',
    minimumRole: Roles.Manager,
    group: 'san-pham',
  },
  {
    key: 'media',
    label: 'Media',
    href: '/media',
    minimumRole: Roles.Manager,
    group: 'san-pham',
  },

  {
    key: 'inventory',
    label: 'Kho hàng',
    href: '/kho-hang',
    minimumRole: Roles.Staff,
    group: 'van-hanh',
  },
  {
    key: 'warehouses',
    label: 'Cửa hàng & kho',
    href: '/cua-hang-kho',
    minimumRole: Roles.Staff,
    group: 'van-hanh',
  },
  {
    key: 'orders',
    label: 'Đơn hàng',
    href: '/don-hang',
    minimumRole: Roles.Staff,
    group: 'van-hanh',
  },
  {
    key: 'payments',
    label: 'Thanh toán',
    href: '/thanh-toan',
    minimumRole: Roles.Staff,
    group: 'van-hanh',
  },
  {
    key: 'shipping',
    label: 'Vận chuyển',
    href: '/van-chuyen',
    minimumRole: Roles.Staff,
    group: 'van-hanh',
  },

  {
    key: 'reviews',
    label: 'Đánh giá',
    href: '/danh-gia',
    minimumRole: Roles.Staff,
    group: 'cham-soc',
  },
  {
    key: 'warranty',
    label: 'Bảo hành & đổi trả',
    href: '/bao-hanh',
    minimumRole: Roles.Staff,
    group: 'cham-soc',
  },
  {
    key: 'support',
    label: 'Hỗ trợ',
    href: '/ho-tro',
    minimumRole: Roles.Staff,
    group: 'cham-soc',
  },
  {
    key: 'notifications',
    label: 'Thông báo',
    href: '/thong-bao',
    minimumRole: Roles.Manager,
    group: 'cham-soc',
  },

  {
    key: 'reporting',
    label: 'Báo cáo',
    href: '/bao-cao',
    minimumRole: Roles.Manager,
    group: 'he-thong',
  },
  {
    key: 'audit',
    label: 'Nhật ký',
    href: '/nhat-ky',
    minimumRole: Roles.Admin,
    group: 'he-thong',
  },
  {
    key: 'users',
    label: 'Người dùng',
    href: '/nguoi-dung',
    minimumRole: Roles.SuperAdmin,
    group: 'he-thong',
  },
];

export const MENU_GROUP_LABELS: Record<AdminMenuItem['group'], string> = {
  chinh: 'Tổng quan',
  'san-pham': 'Sản phẩm & danh mục',
  'van-hanh': 'Vận hành',
  'cham-soc': 'Chăm sóc khách hàng',
  'he-thong': 'Hệ thống',
};

/** Lọc menu theo vai trò hiện có — dùng `hasMinimumRole` để so khớp thứ hạng vai trò. */
export function filterMenuByRoles(
  items: readonly AdminMenuItem[],
  roles: readonly Role[],
): AdminMenuItem[] {
  return items.filter((item) => hasMinimumRole(roles, item.minimumRole));
}
