'use client';

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

/**
 * Error fallback component specifically for booking-related errors
 * Enhanced with context-specific handling
 */
export default function BookingErrorFallback({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [errorType, setErrorType] = useState<'context' | 'availability' | 'network' | 'dates' | 'unknown'>('unknown');
  const [refreshNeeded, setRefreshNeeded] = useState(false);

  // Analyze the error to provide better guidance
  useEffect(() => {
    if (!error) return;

    // Check error message and stack for known patterns
    const errorInfo = error.message + (error.stack || '');

    if (errorInfo.includes('context') || errorInfo.includes('provider') || errorInfo.includes('BookingContext')) {
      setErrorType('context');
      setRefreshNeeded(true);
    } else if (errorInfo.includes('network') || errorInfo.includes('fetch') || errorInfo.includes('ECONNREFUSED')) {
      setErrorType('network');
    } else if (errorInfo.includes('availability') || errorInfo.includes('unavailable')) {
      setErrorType('availability');
    } else if (errorInfo.includes('date') || errorInfo.includes('Date') || errorInfo.includes('invalid date')) {
      setErrorType('dates');
    }

    // Log for debugging - this won't show to users
    console.error('[BookingErrorFallback] Analyzed error:', {
      type: errorType,
      message: error.message,
      needsRefresh: refreshNeeded
    });
  }, [error, errorType, refreshNeeded]);

  // User-friendly messages based on error type
  const getErrorMessage = () => {
    switch (errorType) {
      case 'context':
        return "There was a problem with the booking system initialization. This is often fixed by refreshing the page.";
      case 'network':
        return "We couldn't connect to the booking service. Please check your internet connection and try again.";
      case 'availability':
        return "There was an issue checking room availability. Please try again or contact the host directly.";
      case 'dates':
        return "There was a problem with the selected dates. Please try selecting different dates.";
      default:
        return error.message || "An unexpected error occurred with the booking system.";
    }
  };

  // Handle reset with potential page refresh for context errors
  const handleReset = () => {
    // First try the normal reset
    reset();

    // For context errors, we might need a full page refresh
    if (refreshNeeded) {
      // Add a small delay to allow the React component to attempt reset first
      setTimeout(() => {
        // Reset session storage related to booking
        if (typeof window !== 'undefined') {
          // Clear any booking-related session storage
          Object.keys(sessionStorage).forEach(key => {
            if (key.startsWith('booking_')) {
              sessionStorage.removeItem(key);
            }
          });
        }

        // Reload the page to get a fresh context
        window.location.reload();
      }, 100);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
      <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md border border-amber-100">
        <div className="flex items-center mb-4">
          <AlertTriangle className="h-6 w-6 text-amber-500 mr-2" />
          <h2 className="text-xl font-semibold text-amber-700">
            Booking System Issue
          </h2>
        </div>

        <div className="bg-amber-50 p-4 rounded-md mb-6">
          <p className="text-sm text-amber-800">
            {getErrorMessage()}
          </p>
          {error.digest && (
            <p className="text-xs text-amber-600 mt-2">
              Error reference: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col space-y-3">
          <Button
            onClick={handleReset}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            {refreshNeeded ? "Refresh and Try Again" : "Try Again"}
          </Button>

          <Button
            variant="outline"
            className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
            asChild
          >
            <Link href="/">
              <Home className="h-4 w-4 mr-2" />
              Return to Homepage
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}