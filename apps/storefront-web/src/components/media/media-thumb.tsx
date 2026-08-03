'use client';

import { useEffect, useRef, useState } from 'react';
import { bff } from '../../lib/api-browser';
import type { MediaDownloadUrlResult } from '../../lib/types';
import styles from './media-thumb.module.css';

const urlCache = new Map<string, string>();

function isHttpUrl(value?: string | null): value is string {
  return Boolean(value) && /^https?:\/\//i.test(value as string);
}

export interface MediaThumbProps {
  /** URL đầy đủ hoặc mediaId cần resolve qua media-service. */
  mediaRef?: string | null;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

/**
 * Hiển thị ảnh sản phẩm/sku. Nếu `mediaRef` là URL trực tiếp thì dùng luôn;
 * nếu là mediaId thì resolve qua `/api/bff/media/media/:id/download-url`.
 * Khi chưa có ảnh (chưa seed media), hiển thị placeholder gradient thương hiệu.
 */
export function MediaThumb({
  mediaRef,
  alt,
  className,
  fallbackLabel,
}: MediaThumbProps) {
  const directUrl = isHttpUrl(mediaRef) ? mediaRef : undefined;
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(
    directUrl ?? (mediaRef ? urlCache.get(mediaRef) : undefined),
  );
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setLoaded(false);
  }, [resolvedUrl]);

  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [resolvedUrl]);

  useEffect(() => {
    if (directUrl || !mediaRef) {
      return;
    }
    const cached = urlCache.get(mediaRef);
    if (cached) {
      setResolvedUrl(cached);
      return;
    }
    let cancelled = false;
    bff
      .get<MediaDownloadUrlResult>(
        `/api/bff/media/media/${mediaRef}/download-url`,
      )
      .then((res) => {
        if (!cancelled && res?.downloadUrl) {
          urlCache.set(mediaRef, res.downloadUrl);
          setResolvedUrl(res.downloadUrl);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [mediaRef, directUrl]);

  if (!resolvedUrl) {
    const letter =
      (fallbackLabel ?? alt ?? 'N').trim().charAt(0).toUpperCase() || 'N';
    return (
      <div
        className={`${styles.placeholder} ${className ?? ''}`}
        role="img"
        aria-label={alt}
      >
        <span aria-hidden="true">{letter}</span>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {!loaded ? <div className={styles.skeleton} aria-hidden="true" /> : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- host media động theo môi trường */}
      <img
        ref={imgRef}
        src={resolvedUrl}
        alt={alt}
        className={`${styles.imageLoaded} ${loaded ? styles.isVisible : ''} ${className ?? ''}`}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}
