import { AdminPage } from '@/components/admin';
import { DashboardSkeleton } from './_components/dashboard-skeleton';

export default function DashboardLoading() {
  return (
    <AdminPage title="Dashboard" description="Overview of your rental business">
      <DashboardSkeleton />
    </AdminPage>
  );
}
