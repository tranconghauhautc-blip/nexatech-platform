import { Roles, hasMinimumRole, type Role } from '@nexatech/shared-auth';

export interface AdminMenuItem {
  href: string;
  label: string;
  minimumRole: Role;
}

export const ADMIN_MENU_ITEMS: readonly AdminMenuItem[] = [
  {
    href: '/bang-dieu-khien',
    label: 'Bảng điều khiển',
    minimumRole: Roles.Staff,
  },
  { href: '/san-pham', label: 'Sản phẩm', minimumRole: Roles.Staff },
  { href: '/danh-muc', label: 'Danh mục', minimumRole: Roles.Staff },
  { href: '/thuong-hieu', label: 'Thương hiệu', minimumRole: Roles.Staff },
  { href: '/thong-so', label: 'Thông số', minimumRole: Roles.Manager },
  { href: '/kho-hang', label: 'Tồn kho', minimumRole: Roles.Staff },
  {
    href: '/cua-hang-kho',
    label: 'Kho & cửa hàng',
    minimumRole: Roles.Staff,
  },
  { href: '/don-hang', label: 'Đơn hàng', minimumRole: Roles.Staff },
  { href: '/thanh-toan', label: 'Thanh toán', minimumRole: Roles.Staff },
  { href: '/van-chuyen', label: 'Vận chuyển', minimumRole: Roles.Staff },
  { href: '/danh-gia', label: 'Đánh giá', minimumRole: Roles.Staff },
  {
    href: '/bao-hanh',
    label: 'Bảo hành / đổi trả',
    minimumRole: Roles.Staff,
  },
  { href: '/ho-tro', label: 'Hỗ trợ', minimumRole: Roles.Staff },
  { href: '/thong-bao', label: 'Thông báo', minimumRole: Roles.Staff },
  { href: '/bao-cao', label: 'Báo cáo', minimumRole: Roles.Manager },
  { href: '/nhat-ky', label: 'Nhật ký audit', minimumRole: Roles.Manager },
  { href: '/media', label: 'Media', minimumRole: Roles.Staff },
  {
    href: '/nguoi-dung',
    label: 'Người dùng',
    minimumRole: Roles.SuperAdmin,
  },
] as const;

export function filterAdminMenu(roles: readonly Role[]): AdminMenuItem[] {
  return ADMIN_MENU_ITEMS.filter((item) =>
    hasMinimumRole(roles, item.minimumRole),
  );
}
