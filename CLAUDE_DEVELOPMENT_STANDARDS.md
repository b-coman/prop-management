# Development Standards - RentalSpot Project

**Last Updated**: 2026-02-04

## Core Rules

### 1. File Management
- **ONE file per component** - no duplicates, no version suffixes
- **Modify existing files** - never create `ComponentV2.tsx` alongside `Component.tsx`
- **Delete unused code** - don't comment out or mark deprecated, just remove it

### 2. Testing Before Completion
A task is ONLY complete when:
- Build succeeds (`npm run build`)
- Dev server runs without crashes
- Functionality tested manually
- Edge cases checked

**Never claim completion without verification.**

### 3. No Mock Data
- Always use real Firestore data
- No hardcoded values in components
- No stub functions that return fake data

## Logging Standards

### Use Structured Logger (Not console.*)

```typescript
// Import
import { loggers } from '@/lib/logger';
const logger = loggers.booking;  // Choose appropriate namespace

// Levels
logger.debug('Detailed info', { data });     // Dev only, disabled in prod
logger.info('Operation completed', { id });   // Normal operations
logger.warn('Unexpected state', { context }); // Potential issues
logger.error('Failed', error as Error, { context }); // Errors with stack trace
```

### Available Namespaces

| Namespace | Use For |
|-----------|---------|
| `loggers.booking` | Booking creation, updates, status changes |
| `loggers.bookingContext` | Client-side booking state management |
| `loggers.stripe` | Payment processing, webhooks, checkout sessions |
| `loggers.admin` | Admin panel operations |
| `loggers.adminPricing` | Pricing rules, seasons, date overrides |
| `loggers.adminBookings` | Admin booking management |
| `loggers.availability` | Availability checks and updates |
| `loggers.email` | Email sending operations |

### Logging Patterns

```typescript
// Function entry with context
logger.debug('Processing booking', { bookingId, propertyId });

// Success with relevant data
logger.info('Booking created', { bookingId: doc.id, status: 'pending' });

// Warnings for non-fatal issues
logger.warn('Currency rates not available, using defaults');

// Errors with full context
logger.error('Failed to create booking', error as Error, {
  propertyId,
  guestEmail: input.guestInfo?.email
});
```

## Firebase SDK Patterns

### When to Use Each SDK

| SDK | Use When | Example |
|-----|----------|---------|
| **Client SDK** | Browser code, Server Actions | Booking creation, form submissions |
| **Admin SDK** | API routes, cron jobs | Webhooks, scheduled tasks |

### Client SDK (rules apply)
```typescript
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

// In server action ("use server")
const docRef = await addDoc(collection(db, 'bookings'), data);
```

### Admin SDK (bypasses rules)
```typescript
import { getFirestoreForPricing } from '@/lib/firebaseAdminPricing';

// In API route
const db = await getFirestoreForPricing();
const snapshot = await db.collection('bookings').where('status', '==', 'on-hold').get();
```

### Key Insight
Server Actions use Client SDK, so Firestore security rules still apply. Only API routes with Admin SDK can bypass rules.

## Code Organization

```
src/
├── app/                    # Next.js App Router
│   ├── admin/             # Admin pages and actions
│   ├── api/               # API routes (use Admin SDK here)
│   ├── booking/           # Public booking pages
│   └── actions/           # Shared server actions
├── components/
│   └── booking-v2/        # Booking system components
│       ├── contexts/      # BookingProvider
│       ├── components/    # UI components
│       └── hooks/         # Custom hooks
├── services/              # Business logic
│   ├── bookingService.ts  # Booking CRUD operations
│   └── emailService.ts    # Email sending
└── lib/
    ├── firebase.ts        # Client SDK init
    ├── firebaseAdminSafe.ts    # Admin SDK init
    ├── firebaseAdminPricing.ts # Admin SDK with caching
    ├── logger.ts          # Structured logging
    └── availability-service.ts # Availability checks
```

## Error Handling

### In Server Actions
```typescript
export async function createBooking(input: Input): Promise<Result> {
  try {
    // ... operation
    return { success: true, bookingId: doc.id };
  } catch (error) {
    logger.error('Failed to create booking', error as Error, { propertyId });

    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('PERMISSION_DENIED')) {
      return { error: 'Permission denied', errorType: 'permission_error', retry: false };
    }

    if (message.includes('network') || message.includes('timeout')) {
      return { error: 'Network error', errorType: 'network_error', retry: true };
    }

    return { error: 'Operation failed', retry: true };
  }
}
```

### In API Routes
```typescript
export async function GET(request: NextRequest) {
  try {
    // ... operation
    return NextResponse.json({ success: true, data });
  } catch (error) {
    logger.error('API error', error as Error);
    return NextResponse.json(
      { error: 'Failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
```

## Commit Standards

```bash
# Format
<type>: <short description>

<body - what and why>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
```

Types: `feat`, `fix`, `refactor`, `docs`, `perf`, `security`

## Lessons Learned

### Test Before Claiming Done
- Build errors go unnoticed if you don't run `npm run build`
- Runtime errors are ignored if you don't test the actual functionality
- "It should work" is not verification

### Incremental Verification
After EVERY code change:
1. Check if it builds: `npm run build`
2. Test actual functionality manually
3. Fix any issues before moving on

### Documentation Honesty
- Don't write "Migration completed successfully" without testing
- Document known issues rather than hiding them
- Code that works > documentation that claims it works
