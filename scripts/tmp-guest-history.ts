import { config } from 'dotenv';
config({ path: '.env.local' });
import * as admin from 'firebase-admin';
import * as fs from 'fs';
const p = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH!;
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(p, 'utf8'))) });
const db = admin.firestore();
(async () => {
  for (const phone of ['+40743408597','0743408597','743408597']) {
    const s = await db.collection('guests').where('phone','==',phone).get();
    if (s.size) s.docs.forEach(d => console.log('GUEST MATCH', phone, d.id, JSON.stringify({name:d.data().name||d.data().firstName, bookingIds:d.data().bookingIds, kind:d.data().kind, createdAt:d.data().createdAt?.toDate?.()?.toISOString()})));
  }
  const all = await db.collection('guests').get();
  const hits = all.docs.filter(d => JSON.stringify(d.data()).includes('743408597'));
  console.log('guests total:', all.size, '| substring hits:', hits.length, hits.map(h=>h.id).join(','));
  hits.forEach(h => console.log(JSON.stringify(h.data(), null, 1).slice(0,900)));
  const th = await db.collection('whatsappThreads').get();
  const twh = th.docs.filter(d => d.id.includes('743408597') || JSON.stringify(d.data()).includes('743408597'));
  console.log('whatsappThreads:', th.size, '| hits:', twh.map(t=>t.id).join(','));
  process.exit(0);
})();
