/**
 * @fileoverview Redirect from old hold-success URL to consolidated success page
 * @module app/booking/hold-success/page
 * @description Redirects /booking/hold-success to /booking/success with type=hold parameter
 * @file-status: DEPRECATED - Use /booking/success instead
 */

import { redirect } from 'next/navigation';

interface HoldSuccessPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HoldSuccessPage({ searchParams }: HoldSuccessPageProps) {
  const params = await searchParams;

  // Build the redirect URL preserving all query parameters
  const urlParams = new URLSearchParams();

  // Add type=hold to indicate this is a hold booking
  urlParams.set('type', 'hold');

  // Preserve existing parameters
  if (params.booking_id) {
    urlParams.set('booking_id', String(params.booking_id));
  }
  if (params.session_id) {
    urlParams.set('session_id', String(params.session_id));
  }

  // Preserve any other parameters
  for (const [key, value] of Object.entries(params)) {
    if (key !== 'booking_id' && key !== 'session_id' && value) {
      urlParams.set(key, String(value));
    }
  }

  redirect(`/booking/success?${urlParams.toString()}`);
}
