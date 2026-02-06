"use client";

import { useEffect } from 'react';
import { captureAndStoreAttribution } from '@/lib/utm';

export function UTMCapture() {
  useEffect(() => {
    captureAndStoreAttribution();
  }, []);

  return null;
}
