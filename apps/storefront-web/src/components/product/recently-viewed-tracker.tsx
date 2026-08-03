'use client';

import { useEffect } from 'react';
import { bff } from '../../lib/api-browser';
import {
  clearRecentlyViewedLocal,
  pushRecentlyViewed,
} from '../../lib/recently-viewed';
import { useAuth } from '../providers/auth-provider';

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
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (isAuthenticated) {
      bff
        .post('/api/bff/cart/recently-viewed', { productId: id })
        .then(() => {
          clearRecentlyViewedLocal();
        })
        .catch(() => {
          // cart-service is source of truth when logged in; ignore transient errors
        });
      return;
    }
    pushRecentlyViewed({ id, slug, name, price, thumbnailMediaId, brandName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAuthenticated, loading]);

  return null;
}
