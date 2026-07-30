export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'nx-badge-neutral',
  success: 'nx-badge-success',
  warning: 'nx-badge-warning',
  danger: 'nx-badge-danger',
  info: 'nx-badge-info',
};

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
}) {
  return <span className={`nx-badge ${TONE_CLASS[tone]}`}>{children}</span>;
}
