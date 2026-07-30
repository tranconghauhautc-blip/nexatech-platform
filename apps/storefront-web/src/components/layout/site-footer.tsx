import Link from 'next/link';
import { NAV_CATEGORIES } from '../../lib/constants';
import styles from './site-footer.module.css';

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.root}>
      <div className={`nt-container ${styles.grid}`}>
        <div className={styles.brandCol}>
          <div className={styles.logo}>
            Nexa<span className={styles.logoAccent}>Tech</span>
          </div>
          <p className={styles.tagline}>
            Công nghệ chính hãng — điện thoại, laptop, tablet, đồng hồ thông
            minh, tai nghe & loa, phụ kiện. Giao hàng toàn quốc, bảo hành minh
            bạch.
          </p>
        </div>

        <div className={styles.col}>
          <h3 className={styles.colTitle}>Danh mục</h3>
          <ul className={styles.linkList}>
            {NAV_CATEGORIES.map((category) => (
              <li key={category.slug}>
                <Link href={`/danh-muc/${category.slug}`}>
                  {category.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className={styles.col}>
          <h3 className={styles.colTitle}>Hỗ trợ khách hàng</h3>
          <ul className={styles.linkList}>
            <li>
              <Link href="/tai-khoan/ho-tro">Trung tâm hỗ trợ</Link>
            </li>
            <li>
              <Link href="/tai-khoan/bao-hanh">Bảo hành & đổi trả</Link>
            </li>
            <li>
              <Link href="/tai-khoan/don-hang">Tra cứu đơn hàng</Link>
            </li>
            <li>
              <Link href="/thanh-toan">Hướng dẫn thanh toán</Link>
            </li>
          </ul>
        </div>

        <div className={styles.col}>
          <h3 className={styles.colTitle}>Tài khoản</h3>
          <ul className={styles.linkList}>
            <li>
              <Link href="/dang-nhap">Đăng nhập</Link>
            </li>
            <li>
              <Link href="/dang-ky">Đăng ký</Link>
            </li>
            <li>
              <Link href="/tai-khoan/yeu-thich">Danh sách yêu thích</Link>
            </li>
            <li>
              <Link href="/tai-khoan/so-sanh">So sánh sản phẩm</Link>
            </li>
          </ul>
        </div>
      </div>

      <div className={`nt-container ${styles.bottomBar}`}>
        <p>© {year} NexaTech. Đã đăng ký bản quyền.</p>
        <p className={styles.paymentMethods}>
          Hỗ trợ: COD · VNPay · Chuyển khoản
        </p>
      </div>
    </footer>
  );
}
