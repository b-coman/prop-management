"use client";

import { useEffect } from 'react';
import { trackViewItem } from '@/lib/tracking';
import { trackMetaViewContent } from '@/lib/meta-tracking';
import type { Property } from '@/types';

interface TrackViewItemProps {
  property: Property;
}

export function TrackViewItem({ property }: TrackViewItemProps) {
  useEffect(() => {
    trackViewItem(property);            // GA4 view_item (GTM dataLayer)
    trackMetaViewContent(property);     // Meta Pixel ViewContent (no-op without consent)
  }, [property]);

  return null;
}
