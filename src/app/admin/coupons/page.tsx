
// src/app/admin/coupons/page.tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchCoupons } from './actions'; // Import the fetch function
import { CouponTable } from './_components/coupon-table'; // Import the table component

export const dynamic = 'force-dynamic'; // Ensure the page is dynamically rendered to fetch fresh data

export default async function ManageCouponsPage() {
  const coupons = await fetchCoupons(); // Fetch coupons server-side

  return (
    <div className="container mx-auto py-10">
      <Card className="mx-auto">
        <CardHeader>
          <CardTitle>Manage Coupons</CardTitle>
          <CardDescription>
            View, activate/deactivate, and edit existing discount coupons.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {coupons.length > 0 ? (
            <CouponTable coupons={coupons} />
          ) : (
            <p className="text-center text-muted-foreground">No coupons found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
