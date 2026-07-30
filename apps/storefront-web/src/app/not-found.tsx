import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      className="nt-container"
      style={{ padding: '3rem 0', textAlign: 'center' }}
    >
      <h1>Không tìm thấy trang</h1>
      <p style={{ color: '#4b6478' }}>
        Đường dẫn không tồn tại hoặc đã được di chuyển.
      </p>
      <Link href="/" className="nt-btn nt-btn-primary">
        Về trang chủ
      </Link>
    </div>
  );
}
