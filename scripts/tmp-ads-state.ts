import { config } from 'dotenv';
config({ path: '.env.local' });
import * as admin from 'firebase-admin';
import * as fs from 'fs';
const p = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH!;
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(p, 'utf8'))) });
const db = admin.firestore();
const ts = (v: any) => v?.toDate ? v.toDate().toISOString() : (v?._seconds ? new Date(v._seconds*1000).toISOString() : v);
(async () => {
  const cols = await db.listCollections();
  console.log('COLLECTIONS:', cols.map(c => c.id).join(', '));
  for (const name of ['adDrafts','ads','adOutcomes','campaigns']) {
    try {
      const s = await db.collection(name).orderBy('createdAt','desc').limit(6).get();
      console.log(`\n=== ${name} (${s.size}) ===`);
      s.docs.forEach(d => { const x = d.data() as any;
        console.log(d.id, JSON.stringify({status:x.status, name:x.name, objective:x.objective, createdAt:ts(x.createdAt), metaAdId:x.metaAdId, metaCampaignId:x.metaCampaignId, budget:x.budget||x.dailyBudget, window:x.window||x.targetWindow, landing:x.landingUrl||x.landingSlug, keys:Object.keys(x).sort().join(',')}));
      });
    } catch(e:any) { console.log(`\n=== ${name}: ${e.message.slice(0,80)}`); }
  }
  process.exit(0);
})();
