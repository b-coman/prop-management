"use client";

import { useEffect } from 'react';
import { trackViewItem } from '@/lib/tracking';
import { trackMetaViewContentWhenReady } from '@/lib/meta-tracking';
import type { Property } from '@/types';

interface TrackViewItemProps {
  property: Property;
}

export function TrackViewItem({ property }: TrackViewItemProps) {
  useEffect(() => {
    trackViewItem(property);            // GA4 view_item (GTM dataLayer)
    // Same race the landing pages had: `fbq` does not exist at mount, because the consent question
    // is now shown a beat after load rather than immediately. A plain call here no-opped for anyone
    // who accepted AFTER this effect ran, which is now almost everyone. Shared waiter.
    return trackMetaViewContentWhenReady(property);
  }, [property]);

  return null;
}
