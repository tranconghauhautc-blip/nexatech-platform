'use client';

import { useEffect, useState } from 'react';
import { bffRequest } from '../../lib/api-client';

const urlCache = new Map<string, string>();

interface MediaDownloadUrlResult {
  downloadUrl: string;
  expiresIn: number;
}

function isHttpUrl(value?: string | null): value is string {
  return Boolean(value) && /^https?:\/\//i.test(value as string);
}

export interface MediaThumbProps {
  /** URL đầy đủ hoặc mediaId cần resolve qua media-service. */
  mediaRef?: string | null;
  alt: string;
  size?: number;
}

/**
 * Hiển thị ảnh sản phẩm/SKU cho Admin. Nếu `mediaRef` là URL trực tiếp thì
 * dùng luôn; nếu là mediaId thì resolve qua `/api/bff/media/media/:id/download-url`.
 * Khi chưa có ảnh, hiển thị placeholder chữ cái đầu.
 */
export function MediaThumb({ mediaRef, alt, size = 44 }: MediaThumbProps) {
  const directUrl = isHttpUrl(mediaRef) ? mediaRef : undefined;
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(
    directUrl ?? (mediaRef ? urlCache.get(mediaRef) : undefined),
  );

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
    bffRequest<MediaDownloadUrlResult>(
      'media',
      `media/${mediaRef}/download-url`,
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

  const boxStyle: React.CSSProperties = {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: 8,
    overflow: 'hidden',
    background: 'var(--nx-table-header)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (!resolvedUrl) {
    const letter = (alt ?? 'N').trim().charAt(0).toUpperCase() || 'N';
    return (
      <div style={boxStyle} role="img" aria-label={alt}>
        <span
          aria-hidden="true"
          style={{
            fontSize: size * 0.4,
            fontWeight: 700,
            color: 'var(--nx-text-secondary)',
          }}
        >
          {letter}
        </span>
      </div>
    );
  }

  return (
    <div style={boxStyle}>
      {/* eslint-disable-next-line @next/next/no-img-element -- host media động theo môi trường */}
      <img
        src={resolvedUrl}
        alt={alt}
        loading="lazy"
        decoding="async"
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
}
