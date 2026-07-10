import Link from 'next/link';
import { AdminPage } from '@/components/admin';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { fetchComposeDataAction } from '../actions';
import { ComposeForm } from '../_components/compose-form';

export const dynamic = 'force-dynamic';

const DEFAULT_PROPERTY = 'prahova-mountain-chalet';

export default async function NewAdPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { propertyId } = await searchParams;
  const property = propertyId || DEFAULT_PROPERTY;
  const composeData = await fetchComposeDataAction(property);

  return (
    <AdminPage
      title="New ad"
      description="Compose a PAUSED, zero-spend Meta ad draft from an existing property photo. Nothing spends until you Approve and Activate it."
      actions={
        <Button asChild variant="outline">
          <Link href={`/admin/ads?propertyId=${property}`}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to ads
          </Link>
        </Button>
      }
    >
      {composeData ? (
        <ComposeForm
          propertyId={composeData.propertyId}
          images={composeData.images}
          defaultLandingUrl={composeData.defaultLandingUrl}
          maxDailyBudgetMinor={composeData.maxDailyBudgetMinor}
        />
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Could not load property data for &quot;{property}&quot;. Check you have access and the property exists.
          </CardContent>
        </Card>
      )}
    </AdminPage>
  );
}
