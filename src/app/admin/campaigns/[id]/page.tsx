import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AdminPage } from '@/components/admin';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { getCampaign } from '@/services/campaignService';
import type { MessageVariant } from '@/types';
import { MessageComposer } from '../_components/message-composer';
import { OutboxSender } from '../_components/outbox-sender';

export const dynamic = 'force-dynamic';

/**
 * Campaign workspace. While the campaign is a `draft`, the owner composes and
 * reviews (Gate 1). Once approved & queued (`sending`/`sent`), it becomes the
 * manual send list (Gate 2). Only serializable scalars cross to the client —
 * never the raw Firestore doc (Timestamps aren't serializable).
 */
export default async function CampaignWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaign = await getCampaign(id);
  if (!campaign) notFound();

  const isDraft = campaign.status === 'draft';
  const variants = (campaign.messageVariants ?? []) as MessageVariant[];
  const audienceCount = campaign.audienceGuestIds?.length ?? 0;

  return (
    <AdminPage
      title={campaign.name}
      description={
        isDraft
          ? 'Write the message, preview exactly what each guest will get, then approve to queue it for sending.'
          : 'Send each queued message from your own WhatsApp, one tap at a time.'
      }
    >
      <div className="mb-4">
        <Link href={`/admin/campaigns?propertyId=${campaign.propertyId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to campaigns
          </Button>
        </Link>
      </div>

      {isDraft ? (
        <MessageComposer campaignId={id} audienceCount={audienceCount} initialVariants={variants} />
      ) : (
        <OutboxSender campaignId={id} status={campaign.status} />
      )}
    </AdminPage>
  );
}
