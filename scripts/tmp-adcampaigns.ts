import { config } from 'dotenv';
config({ path: '.env.local' });
import * as admin from 'firebase-admin';
import * as fs from 'fs';
const p = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH!;
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(p, 'utf8'))) });
const db = admin.firestore();
const ts = (v: any) => v?.toDate ? v.toDate().toISOString() : (v?._seconds ? new Date(v._seconds*1000).toISOString() : v);
(async () => {
  const s = await db.collection('adCampaigns').get();
  console.log(`adCampaigns: ${s.size}`);
  s.docs.forEach(d => { const x = d.data() as any;
    console.log('\n##', d.id, JSON.stringify({status:x.status, name:x.name, createdAt:ts(x.createdAt), updatedAt:ts(x.updatedAt),
      metaCampaignId:x.metaCampaignId, metaAdSetId:x.metaAdSetId, metaAdId:x.metaAdId, effectiveStatus:x.effectiveStatus,
      dailyBudget:x.dailyBudget, budget:x.budget, targetWindow:x.targetWindow, window:x.window,
      landingUrl:x.landingUrl, landingPageId:x.landingPageId, audience:x.audience, targeting:x.targeting,
      pushedAt:ts(x.pushedAt), liveAt:ts(x.liveAt), keys:Object.keys(x).sort().join(',')}, null, 1));
  });
  process.exit(0);
})();
