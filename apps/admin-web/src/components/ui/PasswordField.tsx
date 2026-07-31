'use client';

import { useId, useState } from 'react';
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

  return (
    <div className={`nx-field ${className ?? ''}`}>
      <label className="nx-label" htmlFor={inputId}>
        {label}
      </label>
      <div className={styles.wrap}>
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          className={`nx-input ${error ? 'nx-input-error' : ''} ${styles.input}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
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
      {error ? <span className="nx-error-text">{error}</span> : null}
    </div>
  );
}
