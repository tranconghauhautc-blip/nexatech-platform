'use client';

import { useId, useState } from 'react';
import styles from './password-field.module.css';

export interface PasswordFieldProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  error?: string;
  required?: boolean;
}

export function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = 'current-password',
  error,
  required,
}: PasswordFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>{label}</label>
      <div className={styles.wrap}>
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          required={required}
          className={styles.input}
        />
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
          aria-pressed={visible}
        >
          {visible ? 'Ẩn' : 'Hiện'}
        </button>
      </div>
      {error ? <span className={styles.error}>{error}</span> : null}
    </div>
  );
}
