import Link from 'next/link';
import { AdminPage, EmptyState } from '@/components/admin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PropertyUrlSync } from '@/components/admin/PropertyUrlSync';
import { Target, Plus } from 'lucide-react';
import { fetchAdCampaignsAction } from './actions';
import { AdTable } from './_components/ad-table';

export const dynamic = 'force-dynamic';

const DEFAULT_PROPERTY = 'prahova-mountain-chalet';

export default async function AdsPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { propertyId } = await searchParams;
  const property = propertyId || DEFAULT_PROPERTY;
  const campaigns = await fetchAdCampaignsAction(property);

  return (
    <AdminPage
      title="Ads"
      description="Compose, approve, and activate Meta (Facebook + Instagram) ads from a property photo. Dark-launched — composing always creates a zero-spend PAUSED draft; activation only spends once both engine switches are on."
      actions={
        <Button asChild>
          <Link href={`/admin/ads/new?propertyId=${property}`}>
            <Plus className="mr-1 h-4 w-4" />
            New ad
          </Link>
        </Button>
      }
    >
      <PropertyUrlSync />
      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
          <CardDescription>Every row started as a PAUSED, zero-spend draft. Approve, then activate.</CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length > 0 ? (
            <AdTable campaigns={campaigns} />
          ) : (
            <EmptyState
              icon={Target}
              title="No ads yet"
              description="Compose your first ad from a property photo."
            />
          )}
        </CardContent>
      </Card>
    </AdminPage>
  );
}
