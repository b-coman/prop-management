// src/app/admin/page.tsx
import { Suspense } from 'react';
import { fetchDashboardData } from './_actions';
import { DashboardContent } from './_components/dashboard-content';
import { DashboardSkeleton } from './_components/dashboard-skeleton';

export const dynamic = 'force-dynamic';

async function DashboardData() {
  const data = await fetchDashboardData();
  return <DashboardContent data={data} />;
}

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardData />
      </Suspense>
    </div>
  );
}
