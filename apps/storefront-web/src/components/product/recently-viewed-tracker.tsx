'use client';

import { useEffect } from 'react';
import { pushRecentlyViewed } from '../../lib/recently-viewed';

export function RecentlyViewedTracker({
  id,
  slug,
  name,
  price,
  thumbnailMediaId,
  brandName,
}: {
  id: string;
  slug: string;
  name: string;
  price: number;
  thumbnailMediaId?: string | null;
  brandName?: string | null;
}) {
  useEffect(() => {
    pushRecentlyViewed({ id, slug, name, price, thumbnailMediaId, brandName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return null;
}
