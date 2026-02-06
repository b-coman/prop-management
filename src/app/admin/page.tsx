// src/app/admin/page.tsx
import { Suspense } from 'react';
import { fetchDashboardData } from './_actions';
import { DashboardContent } from './_components/dashboard-content';
import { DashboardSkeleton } from './_components/dashboard-skeleton';
import { AdminPage } from '@/components/admin';

export const dynamic = 'force-dynamic';

async function DashboardData() {
  const data = await fetchDashboardData();
  return <DashboardContent data={data} />;
}

export default function AdminDashboardPage() {
  return (
    <AdminPage title="Dashboard" description="Overview of your rental business">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardData />
      </Suspense>
    </AdminPage>
  );
}
