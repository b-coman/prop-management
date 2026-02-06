// src/app/admin/reviews/page.tsx
import { Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { fetchReviews } from './actions';
import { ReviewsWithFilter } from './_components/reviews-with-filter';
import { AdminPage, TableSkeleton } from '@/components/admin';

export const dynamic = 'force-dynamic';

async function ReviewsContent() {
  const reviews = await fetchReviews();

  return (
    <Card>
      <CardContent className="pt-6">
        <ReviewsWithFilter reviews={reviews} />
      </CardContent>
    </Card>
  );
}

export default function ManageReviewsPage() {
  return (
    <AdminPage
      title="Reviews"
      description="Manage guest reviews, respond to feedback, and control review visibility"
    >
      <Suspense fallback={<Card><CardContent className="pt-6"><TableSkeleton columns={7} rows={5} /></CardContent></Card>}>
        <ReviewsContent />
      </Suspense>
    </AdminPage>
  );
}
