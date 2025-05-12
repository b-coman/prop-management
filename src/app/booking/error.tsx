'use client';
 
import BookingErrorFallback from './ErrorFallback';

/**
 * This file serves as a dedicated error boundary for the booking routes
 * Next.js 13+ App Router will automatically use this component when errors occur
 */
export default function BookingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <BookingErrorFallback error={error} reset={reset} />;
}