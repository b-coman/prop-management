/**
 * Growth Engine — campaign dry-run INTEGRATION test against live Firestore.
 * Creates a small capped campaign, runs it (dry-run: records intent, sends
 * nothing), verifies the messageLog entries, then DELETES everything it made.
 * Usage: npx tsx scripts/growth-validate-campaign.ts
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createCampaign, sendCampaign } from '@/services/campaignService';
import { PREDEFINED_SEGMENTS } from '@/services/segmentService';
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const P = 'prahova-mountain-chalet';

(async () => {
  console.log('=== Campaign dry-run integration test (live Firestore) ===');
  console.log('(no messages are delivered — dark-launch default is dry-run)\n');

  const id = await createCampaign({
    name: 'VALIDATION — repeat-guest winter reactivation (dry-run)',
    propertyId: P,
    channel: 'whatsapp',
    templateName: 'winter_invite',
    variables: { '1': 'friend' },
    segmentDefinition: PREDEFINED_SEGMENTS.repeatGuests(P),
  });
  console.log('created campaign:', id);

  const res = await sendCampaign(id, { cap: 3 });
  console.log('sendCampaign result:', JSON.stringify(res, null, 2));

  const db = await getAdminDb();
  const logs = await db.collection('messageLog').where('campaignId', '==', id).get();
  console.log(`\nmessageLog entries written for this campaign: ${logs.size}`);
  logs.docs.forEach((d) => {
    const x = d.data();
    console.log(`  - status=${x.status} channel=${x.channel} template=${x.templateName} to=${x.to}`);
  });

  // Clean up everything this test created.
  const batch = db.batch();
  logs.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(db.collection('campaigns').doc(id));
  await batch.commit();
  console.log(`\ncleaned up: ${logs.size} messageLog entries + campaign ${id}`);
  process.exit(0);
})().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
