
// src/app/admin/coupons/new/page.tsx
import { CouponForm } from './_components/coupon-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function NewCouponPage() {
  return (
    <div className="container mx-auto py-10">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Create New Coupon</CardTitle>
          <CardDescription>
            Fill out the form below to add a new discount coupon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CouponForm />
        </CardContent>
      </Card>
    </div>
  );
}
