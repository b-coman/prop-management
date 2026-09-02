import { config } from 'dotenv';
config({ path: '.env.local' });
import * as admin from 'firebase-admin';
import * as fs from 'fs';

const p = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH!;
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(p, 'utf8'))) });
const db = admin.firestore();

const ts = (v: any) => v?.toDate ? v.toDate().toISOString() : (v?._seconds ? new Date(v._seconds*1000).toISOString() : v);

(async () => {
  const snap = await db.collection('bookings').orderBy('createdAt', 'desc').limit(10).get();
  for (const d of snap.docs) {
    const b = d.data() as any;
    console.log(JSON.stringify({
      id: d.id, propertyId: b.propertyId, source: b.source, status: b.status,
      createdAt: ts(b.createdAt), checkIn: ts(b.checkInDate), checkOut: ts(b.checkOutDate),
      guest: b.guestInfo ? { name: `${b.guestInfo.firstName||''} ${b.guestInfo.lastName||''}`.trim(), email: b.guestInfo.email, phone: b.guestInfo.phone, country: b.guestInfo.country, language: b.guestInfo.language } : null,
      total: b.pricing?.total ?? b.totalPrice,
      allKeys: Object.keys(b).sort().join(','),
    }));
    console.log('---');
  }
  process.exit(0);
})();
