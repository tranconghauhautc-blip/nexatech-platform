'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="nt-container" style={{ padding: '3rem 0' }}>
      <h1>Đã xảy ra lỗi</h1>
      <p style={{ color: '#4b6478' }}>{error.message || 'Vui lòng thử lại.'}</p>
      <button type="button" className="nt-btn nt-btn-primary" onClick={reset}>
        Thử lại
      </button>
    </div>
  );
}
