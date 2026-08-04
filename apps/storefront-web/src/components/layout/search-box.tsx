'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useId, useState } from 'react';
import styles from './search-box.module.css';

export function SearchBox({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputId = useId();
  const [value, setValue] = useState(searchParams.get('q') ?? '');

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    router.push(
      trimmed ? `/tim-kiem?q=${encodeURIComponent(trimmed)}` : '/tim-kiem',
    );
  }

  return (
    <form
      className={`${styles.form} ${className ?? ''}`}
      onSubmit={handleSubmit}
      role="search"
    >
      <label htmlFor={inputId} className="nt-visually-hidden">
        Tìm kiếm sản phẩm
      </label>
      <svg
        className={styles.icon}
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        id={inputId}
        className={styles.input}
        type="search"
        name="q"
        placeholder="Tìm điện thoại, laptop, tai nghe..."
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <button type="submit" className={styles.button} aria-label="Tìm kiếm">
        Tìm
      </button>
    </form>
  );
}
