import { config } from 'dotenv';
config({ path: '.env.local' });
import * as admin from 'firebase-admin';
import * as fs from 'fs';
const p = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH!;
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(p, 'utf8'))) });
const db = admin.firestore();
(async () => {
  const s = await db.collection('consentEvents')
    .where('timestamp','>=', new Date('2026-08-31T18:00:00Z'))
    .where('timestamp','<=', new Date('2026-09-01T12:00:00Z'))
    .orderBy('timestamp').get().catch(async () => await db.collection('consentEvents').orderBy('createdAt','desc').limit(40).get());
  console.log('consentEvents in window:', s.size);
  s.docs.forEach(d => console.log(d.id, JSON.stringify(d.data()).slice(0,400)));
  process.exit(0);
})();
