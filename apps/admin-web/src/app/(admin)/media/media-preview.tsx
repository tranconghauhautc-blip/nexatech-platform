'use client';

import { useEffect, useState } from 'react';
import { bffRequest } from '../../../lib/api-client';
import { isBrowserSafeHttpUrl } from './media-page.helpers';

const urlCache = new Map<string, string>();

interface MediaPreviewProps {
  mediaRef?: string;
  alt?: string;
}

export function MediaPreview({ mediaRef, alt = '' }: MediaPreviewProps) {
  const directUrl =
    mediaRef && isBrowserSafeHttpUrl(mediaRef) ? mediaRef : undefined;
  const [resolvedUrl, setResolvedUrl] = useState<string | undefined>(
    directUrl ?? (mediaRef ? urlCache.get(mediaRef) : undefined),
  );

  useEffect(() => {
    if (directUrl || !mediaRef) {
      setResolvedUrl(directUrl);
      return;
    }
    const cached = urlCache.get(mediaRef);
    if (cached) {
      setResolvedUrl(cached);
      return;
    }
    let cancelled = false;
    bffRequest<{ downloadUrl?: string }>(
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

  if (!resolvedUrl) {
    return <span className="nx-hint">—</span>;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolvedUrl}
      alt={alt}
      style={{
        width: 48,
        height: 48,
        objectFit: 'cover',
        borderRadius: 6,
      }}
    />
  );
}
