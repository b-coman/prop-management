"use client";

import { useEffect } from 'react';
import { trackViewItem } from '@/lib/tracking';
import type { Property } from '@/types';

interface TrackViewItemProps {
  property: Property;
}

export function TrackViewItem({ property }: TrackViewItemProps) {
  useEffect(() => {
    trackViewItem(property);
  }, [property]);

  return null;
}
