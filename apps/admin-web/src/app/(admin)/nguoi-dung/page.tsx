export default function UsersStubPage() {
  return (
    <div className="nx-page">
      <div className="nx-page-header">
        <div>
          <div className="nx-page-title">Người dùng & vai trò</div>
          <div className="nx-page-subtitle">Quản trị identity users</div>
        </div>
      </div>
      <div className="nx-panel">
        <p>
          API admin users/roles của identity-service{' '}
          <strong>chưa được triển khai</strong> theo docs/API-CONTRACTS.md.
          Trang này không giả lập dữ liệu.
        </p>
        <p>Khi contract sẵn sàng, Super Admin sẽ quản lý người dùng tại đây.</p>
      </div>
    </div>
  );
}
