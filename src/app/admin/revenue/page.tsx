import { Suspense } from 'react';
import { AdminPage } from '@/components/admin';
import { RevenueDashboard } from './_components/revenue-dashboard';
import { RevenueSkeleton } from './_components/revenue-skeleton';

export const dynamic = 'force-dynamic';

export default function RevenuePage() {
  return (
    <AdminPage
      title="Revenue"
      description="Track revenue, occupancy, and performance across your properties"
    >
      <Suspense fallback={<RevenueSkeleton />}>
        <RevenueDashboard />
      </Suspense>
    </AdminPage>
  );
}
