import { config } from 'dotenv';
config({ path: '.env.local' });
import * as admin from 'firebase-admin';
import * as fs from 'fs';
const p = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH!;
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(p, 'utf8'))) });
const db = admin.firestore();
(async () => {
  const d = await db.collection('bookings').doc('AdmytnRdmHbIbA85UwWK').get();
  console.log(JSON.stringify(d.data(), null, 2));
  process.exit(0);
})();
