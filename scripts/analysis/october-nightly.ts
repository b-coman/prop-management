/**
 * The three calendars, night by night, for October 2026.
 *
 * Every comparison so far has been a STAY TOTAL, which is what a guest sees but not what the owner
 * sets. He sets a per-night price on each platform, and the totals are downstream of that. Reading
 * the three nightly calendars against each other shows the shape mismatch directly, instead of
 * inferring it from four window totals.
 *
 * Platform figures typed from the owner's own calendar screens on 2026-09-01 (list prices, before
 * length-of-stay discounts and campaigns). Direct comes from the live priceCalendars.
 */
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { STANDING_GUEST_DISCOUNT } from '@/lib/parity/parityView';
import { config } from 'dotenv'; config({ path: '.env.local' });

const BOOKING: Record<number, number> = {
  1:570,2:750,3:750,4:570,5:570,6:570,7:570,8:570,9:750,10:750,11:570,12:570,13:570,14:570,15:570,
  16:750,17:750,18:570,19:570,20:570,21:570,22:570,23:915,24:915,25:695,26:695,27:695,28:695,29:695,30:915,31:915,
};
const AIRBNB: Record<number, number> = {
  1:467,2:612,3:585,4:481,5:463,6:472,7:476,8:476,9:603,10:603,11:458,12:467,13:476,14:440,15:467,
  16:599,17:608,18:463,19:472,20:472,21:467,22:458,23:757,24:735,25:540,26:513,27:481,28:682,29:682,30:896,31:851,
};
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

(async () => {
  const db = await getAdminDb();
  const cal = (await db.collection('priceCalendars').doc('prahova-mountain-chalet_2026-10').get()).data() as any;
  /**
   * The Airbnb column MUST be corrected before it is judged. The listing gives a standing top-rated
   * guests discount the owner treats as near-universal, and no capture can see it - an uncorrected
   * figure runs 12-16% high, which is the difference between "13% cheaper" and "level". Comparing
   * direct against Airbnb's list price is the single easiest way to conclude the opposite of the truth.
   */
  const CORR = 1 - (STANDING_GUEST_DISCOUNT.airbnb ?? 0);
  console.log('OCTOBER 2026, per night. Airbnb corrected by ' +
              `${Math.round((1 - CORR) * 100)}% for the standing top-rated discount.\n`);
  console.log('  day        direct   airbnb(list->eff)  booking   vs cheapest');
  let dearer = 0, band = 0, deep = 0;
  for (let d = 1; d <= 31; d++) {
    const direct = cal.days[String(d)]?.adjustedPrice ?? null;
    const ab = AIRBNB[d], abEff = Math.round(ab * CORR), bk = BOOKING[d];
    const cheapest = Math.min(abEff, bk);
    const gap = direct !== null ? (direct - cheapest) / cheapest : null;
    const dt = new Date(Date.UTC(2026, 9, d));
    const flag = gap === null ? '' : gap > 0.01 ? 'DEARER' : gap >= -0.10 ? 'in band' : 'well under';
    if (gap !== null) { if (gap > 0.01) dearer++; else if (gap >= -0.10) band++; else deep++; }
    console.log(`  ${String(d).padStart(2)} ${DOW[dt.getUTCDay()]}   ${String(direct ?? '-').padStart(7)}   ${String(ab).padStart(4)} -> ${String(abEff).padStart(4)}    ${String(bk).padStart(5)}   ${gap === null ? '' : ((gap*100).toFixed(0)+'%').padStart(5)}  ${flag}`);
  }
  console.log(`\n  ${dearer} nights dearer than the cheapest platform · ${band} inside 1-10% under · ${deep} more than 10% under`);
  console.log('\n  Booking figures are LIST: its campaigns come off on top, so its effective price is');
  console.log('  lower again. Direct is therefore closer to Booking than this column shows.');
  process.exit(0);
})();
