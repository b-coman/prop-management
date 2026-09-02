import { config } from 'dotenv';
config({ path: '.env.local' });
import * as admin from 'firebase-admin';
import * as fs from 'fs';
const p = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH!;
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(p, 'utf8'))) });
const db = admin.firestore();
(async () => {
  const s = await db.collection('consentEvents')
    .where('createdAt','>=', new Date('2026-08-31T20:30:00Z'))
    .where('createdAt','<=', new Date('2026-09-01T02:00:00Z'))
    .orderBy('createdAt').get();
  console.log(`consentEvents 2026-08-31 20:30Z -> 2026-09-01 02:00Z : ${s.size}`);
  console.log('UTC TIME            LOCAL(+3)  OUTCOME  ANALYTICS  CAMPAIGN                PATH');
  s.docs.forEach(d => {
    const x = d.data() as any;
    const t = x.createdAt.toDate();
    const loc = new Date(t.getTime() + 3*3600*1000);
    console.log(`${t.toISOString().slice(0,19)}  ${loc.toISOString().slice(11,19)}   ${String(x.outcome).padEnd(7)}  ${String(x.analytics).padEnd(9)}  ${String(x.campaign).padEnd(22)}  ${x.path}`);
  });
  process.exit(0);
})();
