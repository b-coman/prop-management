"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Root error boundary — catches errors in page components.
 * Has access to the root layout (CSS, fonts, etc).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h2 className="text-xl font-bold text-red-700">Something went wrong</h2>
        <p className="text-sm text-gray-600 mt-2">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={() => reset()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
