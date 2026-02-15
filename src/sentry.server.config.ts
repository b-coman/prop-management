import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: process.env.NODE_ENV === "production",

  // Sample 100% of errors (free tier: 5k/month)
  sampleRate: 1.0,

  // Performance monitoring — sample 10% of server transactions
  tracesSampleRate: 0.1,

  // Don't send PII
  sendDefaultPii: false,
});
