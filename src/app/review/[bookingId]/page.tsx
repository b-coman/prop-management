import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { validateReviewToken } from '@/lib/review-token';
import { Timestamp as AdminTimestamp } from 'firebase-admin/firestore';
import ReviewSubmissionForm from './_components/review-submission-form';

function parseFirestoreDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof AdminTimestamp) return raw.toDate();
  if (typeof raw === 'object' && raw !== null && '_seconds' in raw) {
    return new Date((raw as { _seconds: number })._seconds * 1000);
  }
  if (typeof raw === 'string') return new Date(raw);
  if (raw instanceof Date) return raw;
  return null;
}

function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

interface PageProps {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ token?: string }>;
}

export default async function ReviewPage({ params, searchParams }: PageProps) {
  const { bookingId } = await params;
  const { token } = await searchParams;

  // Error states
  if (!token) {
    return <ErrorPage message="Invalid review link. Please use the link from your email." />;
  }

  let db: FirebaseFirestore.Firestore;
  try {
    db = await getAdminDb();
  } catch {
    return <ErrorPage message="Service temporarily unavailable. Please try again later." />;
  }

  // Fetch booking
  const bookingDoc = await db.collection('bookings').doc(bookingId).get();
  if (!bookingDoc.exists) {
    return <ErrorPage message="Booking not found. This review link may be invalid." />;
  }

  const booking = bookingDoc.data()!;

  // Validate booking status
  if (booking.status !== 'completed') {
    return <ErrorPage message="This booking is not eligible for a review." />;
  }

  // Validate checkout is in the past
  const checkOutDate = parseFirestoreDate(booking.checkOutDate);
  if (!checkOutDate || checkOutDate > new Date()) {
    return <ErrorPage message="Reviews can only be submitted after your stay has ended." />;
  }

  // Validate token
  const guestEmail = booking.guestInfo?.email;
  if (!guestEmail) {
    return <ErrorPage message="Invalid booking data. Please contact support." />;
  }

  const isValidToken = validateReviewToken(bookingId, guestEmail, token);
  if (!isValidToken) {
    return <ErrorPage message="Invalid or expired review link. Please use the link from your email." />;
  }

  // Check if review already exists
  const existingReview = await db
    .collection('reviews')
    .where('bookingId', '==', bookingId)
    .limit(1)
    .get();

  if (!existingReview.empty) {
    return <AlreadyReviewedPage />;
  }

  // Get property name
  const propertyDoc = await db.collection('properties').doc(booking.propertyId).get();
  const property = propertyDoc.data();
  const propertyName = property?.name
    ? (typeof property.name === 'string' ? property.name : property.name?.en || booking.propertyId)
    : booking.propertyId;

  const checkInDate = parseFirestoreDate(booking.checkInDate);
  const language = booking.language || 'en';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <ReviewSubmissionForm
        bookingId={bookingId}
        token={token}
        guestName={`${booking.guestInfo.firstName || ''} ${booking.guestInfo.lastName || ''}`.trim()}
        propertyName={propertyName}
        checkInDate={checkInDate ? formatDateDisplay(checkInDate) : ''}
        checkOutDate={checkOutDate ? formatDateDisplay(checkOutDate) : ''}
        language={language}
      />
    </div>
  );
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Unable to Load Review</h1>
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}

function AlreadyReviewedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Already Reviewed</h1>
        <p className="text-gray-600">You have already submitted a review for this stay. Thank you for your feedback!</p>
      </div>
    </div>
  );
}
