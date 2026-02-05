// src/app/admin/coupons/page.tsx
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { fetchCoupons } from './actions';
import { CouponTable } from './_components/coupon-table';
import { AdminPage, EmptyState } from '@/components/admin';
import { PlusCircle, Ticket } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ManageCouponsPage() {
  const coupons = await fetchCoupons();

  return (
    <AdminPage
      title="Coupons"
      description="View, activate/deactivate, and manage discount coupons"
      actions={
        <Link href="/admin/coupons/new">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" /> Create Coupon
          </Button>
        </Link>
      }
    >
      <Card>
        <CardContent className="pt-6">
          {coupons.length > 0 ? (
            <CouponTable coupons={coupons} />
          ) : (
            <EmptyState
              icon={Ticket}
              title="No coupons yet"
              description="Create your first coupon to offer discounts to guests"
              action={{ label: 'Create Coupon', href: '/admin/coupons/new' }}
            />
          )}
        </CardContent>
      </Card>
    </AdminPage>
  );
}
