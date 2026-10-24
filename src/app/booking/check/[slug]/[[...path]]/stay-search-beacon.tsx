"use client";

import { useEffect, useRef } from 'react';

const BOT_UA = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit/i;

/**
 * Counts this booking-page search for the website's "high demand" badge, from the browser only.
 * Crawlers render pages too, so the server render can't tell a visitor from Googlebot; a browser
 * that runs this effect and isn't a crawler or an automated test browser can. See /api/stay-search.
 */
export function StaySearchBeacon({ propertyId, checkIn, checkOut }: { propertyId: string; checkIn: string; checkOut: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    if (BOT_UA.test(navigator.userAgent) || navigator.webdriver) return;
    fetch('/api/stay-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyId, checkIn, checkOut }),
      keepalive: true,
    }).catch(() => {});
  }, [propertyId, checkIn, checkOut]);
  return null;
}
