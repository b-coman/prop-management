import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminPage } from '@/components/admin';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { fetchAdCampaignAction } from '../actions';
import { AdDetailPanel } from '../_components/ad-detail-panel';

export const dynamic = 'force-dynamic';

export default async function AdDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await fetchAdCampaignAction(id);
  if (!campaign) notFound();

  return (
    <AdminPage
      title={`Ad ${id.slice(0, 10)}…`}
      description={`Property: ${campaign.propertyId}`}
      actions={
        <Button asChild variant="outline">
          <Link href={`/admin/ads?propertyId=${campaign.propertyId}`}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to ads
          </Link>
        </Button>
      }
    >
      <AdDetailPanel campaign={campaign} />
    </AdminPage>
  );
}
