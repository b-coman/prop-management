import { config } from 'dotenv';
config({ path: '.env.local' });
import * as admin from 'firebase-admin';
import * as fs from 'fs';
const p = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH!;
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(p, 'utf8'))) });
const db = admin.firestore();
(async () => {
  const s = await db.collection('consentEvents').limit(3).get();
  console.log('consentEvents sample size:', s.size);
  s.docs.forEach(d => console.log(d.id, JSON.stringify(d.data()).slice(0,500)));
  const cnt = await db.collection('consentEvents').count().get();
  console.log('total consentEvents:', cnt.data().count);
  process.exit(0);
})();
