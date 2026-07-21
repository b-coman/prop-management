import Link from 'next/link';
import { AdminPage, EmptyState } from '@/components/admin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PropertyUrlSync } from '@/components/admin/PropertyUrlSync';
import { Button } from '@/components/ui/button';
import { Megaphone, Plus } from 'lucide-react';
import { fetchCampaigns } from './actions';
import { CampaignTable } from './_components/campaign-table';
import { CampaignComposer } from './_components/campaign-composer';

export const dynamic = 'force-dynamic';

const DEFAULT_PROPERTY = 'prahova-mountain-chalet';

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { propertyId } = await searchParams;
  const property = propertyId || DEFAULT_PROPERTY;
  const campaigns = await fetchCampaigns(property);

  return (
    <AdminPage
      title="Campaigns"
      description="Reach past guests over WhatsApp. Pick an audience, write the message, review each one, then send from your own number — one tap per guest."
      actions={
        <Link href={`/admin/campaigns/new?propertyId=${property}`}>
          <Button>
            <Plus className="mr-1 h-4 w-4" /> New campaign
          </Button>
        </Link>
      }
    >
      <PropertyUrlSync />

      <Card>
        <CardHeader>
          <CardTitle>Your campaigns</CardTitle>
          <CardDescription>
            Open a draft to compose &amp; review; open a queued one to send.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {campaigns.length > 0 ? (
            <CampaignTable campaigns={campaigns} />
          ) : (
            <EmptyState
              icon={Megaphone}
              title="No campaigns yet"
              description="Start with “New campaign” to pick your audience."
            />
          )}
        </CardContent>
      </Card>

      {/* Automated segment path — dark-launched (dry-run only), kept for the future
          engine and tucked away so it doesn't clutter the manual flow. */}
      <details className="rounded-lg border bg-muted/30 px-4 py-3">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
          Advanced: automated segment campaign (dark-launch — dry-run only)
        </summary>
        <div className="mt-4 max-w-md">
          <CampaignComposer propertyId={property} />
        </div>
      </details>
    </AdminPage>
  );
}
