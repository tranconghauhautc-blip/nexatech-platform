'use client';

import { useEffect, useId, useState } from 'react';
import styles from './PasswordField.module.css';

export interface PasswordFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  placeholder?: string;
  error?: string;
  className?: string;
  required?: boolean;
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 3l18 18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M10.6 10.6a2 2 0 002.8 2.8M9.9 5.1A10.5 10.5 0 0121 12c-.7 1.2-1.6 2.3-2.6 3.2M6.1 6.1C4.7 7.3 3.6 8.6 3 12c1.5 4.5 5.5 7.5 9 7.5 1.4 0 2.8-.4 4-.1"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = 'current-password',
  placeholder,
  error,
  className,
  required,
}: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  const hasValue = value.length > 0;

  useEffect(() => {
    if (!hasValue && visible) setVisible(false);
  }, [hasValue, visible]);

  return (
    <div className={`nx-field ${className ?? ''}`}>
      <label className="nx-label" htmlFor={inputId}>
        {label}
      </label>
      <div className={styles.wrap}>
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={`nx-input ${error ? 'nx-input-error' : ''} ${
            hasValue ? styles.inputWithToggle : styles.input
          }`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
        />
        {hasValue ? (
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            aria-pressed={visible}
            title={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          >
            <EyeIcon open={visible} />
          </button>
        ) : null}
      </div>
      {error ? <span className="nx-error-text">{error}</span> : null}
    </div>
  );
}
