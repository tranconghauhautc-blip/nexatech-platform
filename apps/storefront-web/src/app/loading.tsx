export default function Loading() {
  return (
    <div
      className="nt-container nt-skeleton"
      style={{ minHeight: 240, margin: '2rem auto' }}
      role="status"
      aria-busy="true"
    >
      Đang tải…
    </div>
  );
}
