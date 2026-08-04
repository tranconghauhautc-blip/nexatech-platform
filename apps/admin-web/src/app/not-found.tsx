import Link from 'next/link';

export default function NotFound() {
  return (
    <main style={{ padding: '3rem 1.5rem', maxWidth: 640, margin: '0 auto' }}>
      <h1>Không tìm thấy trang</h1>
      <p>Trang admin bạn yêu cầu không tồn tại hoặc đã được di chuyển.</p>
      <p>
        <Link href="/bang-dieu-khien">Về bảng điều khiển</Link>
      </p>
    </main>
  );
}
