import { notFound } from 'next/navigation';
import Link from 'next/link';
import { AdminPage } from '@/components/admin';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { getCampaign } from '@/services/campaignService';
import type { MessageVariant } from '@/types';
import { MessageComposer } from '../_components/message-composer';
import { OutboxSender } from '../_components/outbox-sender';
import { ProposalReview } from '../_components/proposal-review';

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
  // A landed Opportunity-Engine proposal has per-guest drafts already written — Gate 1
  // reviews those instead of the manual variant composer.
  const isProposal = ((campaign as unknown as { perGuestDrafts?: unknown[] }).perGuestDrafts?.length ?? 0) > 0;

  return (
    <AdminPage
      title={campaign.name}
      description={
        !isDraft
          ? 'Send each queued message from your own WhatsApp, one tap at a time.'
          : isProposal
            ? 'Review the prepared campaign — each recipient’s own message and why they were chosen — then approve to queue it.'
            : 'Write the message, preview exactly what each guest will get, then approve to queue it for sending.'
      }
    >
      <div className="mb-4">
        <Link href={`/admin/campaigns?propertyId=${campaign.propertyId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to campaigns
          </Button>
        </Link>
      </div>

      {!isDraft ? (
        <OutboxSender campaignId={id} status={campaign.status} />
      ) : isProposal ? (
        <ProposalReview campaignId={id} />
      ) : (
        <MessageComposer campaignId={id} audienceCount={audienceCount} initialVariants={variants} />
      )}
    </AdminPage>
  );
}
