import * as Sentry from "@sentry/nextjs";

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",

  // Sample 100% of errors (free tier: 5k/month)
  sampleRate: 1.0,

  // Performance monitoring — sample 10% of client transactions
  tracesSampleRate: 0.1,

  // Don't send PII
  sendDefaultPii: false,

  // Filter out noisy browser errors
  beforeSend(event) {
    // Ignore ResizeObserver errors (common browser noise)
    if (event.exception?.values?.[0]?.value?.includes("ResizeObserver")) {
      return null;
    }
    return event;
  },
});
