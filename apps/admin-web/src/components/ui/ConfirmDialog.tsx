'use client';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="nx-overlay center" onClick={onCancel} role="presentation">
      <div
        className="nx-modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 style={{ fontSize: 16, marginBottom: 10 }}>{title}</h3>
        {description ? (
          <p
            style={{
              fontSize: 13.5,
              color: 'var(--nx-text-secondary)',
              marginBottom: 20,
            }}
          >
            {description}
          </p>
        ) : null}
        <div
          className="nx-form-actions"
          style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}
        >
          <button
            type="button"
            className="nx-btn nx-btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`nx-btn ${danger ? 'nx-btn-danger' : 'nx-btn-primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Đang xử lý...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
