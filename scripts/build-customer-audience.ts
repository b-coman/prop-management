#!/usr/bin/env npx tsx
/**
 * build-customer-audience - a Meta Custom Audience seeded on people who actually PAID.
 *
 * WHY: every audience this account has ever used is built from browsing (pixel PageView) or from
 * 2023 page engagement. Neither has ever produced a booking, and Meta has never seen a purchase
 * from this account to learn from. The strongest seed available is the guest book itself: whatever
 * makes a buyer a buyer - income included - is already encoded in it, without anyone having to
 * guess a proxy for it.
 *
 * PHONE ONLY, and that is not a preference: 2 of 188 Prahova bookings carry a usable email, because
 * the OTA imports strip it. 169 carry a real phone.
 *
 * Numbers are SHA256-hashed here, before they leave the machine. Meta never receives a raw number.
 *
 * BLOCKED until the CUSTOMER FILE terms are accepted for the ad account. `tos_accepted` currently
 * reads {web_custom_audience_tos: 1}, which covers pixel audiences only. The script checks this and
 * refuses rather than failing halfway through an upload.
 *
 * Dry-run unless --apply. Dry run hashes and reports, and sends nothing.
 *
 *   npx tsx scripts/build-customer-audience.ts                 # what would be uploaded
 *   npx tsx scripts/build-customer-audience.ts --apply         # create + upload
 */
import * as dotenv from 'dotenv'; import * as path from 'path'; import { execSync } from 'child_process';
import { createHash } from 'crypto';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
process.env.META_ADS_TOKENS = execSync('gcloud secrets versions access latest --secret=META_ADS_TOKENS --project=rentalspot-fzwom', { encoding: 'utf8' }).trim();
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { resolveAdContext } from '@/services/growth/metaAds/adContext';

const PROPERTY = process.argv.find(a=>a.startsWith('--property='))?.split('=')[1] ?? 'prahova-mountain-chalet';
const APPLY = process.argv.includes('--apply');
/** Also pull RO mobiles off the `guests` collection: enquiries and leads who never booked. */
const PROSPECTS = process.argv.includes('--include-prospects');
/** Add to an EXISTING audience instead of creating another one. Meta dedups by hash, so re-sending
 *  numbers already in it is harmless - that is what makes this script safe to re-run as guests grow. */
const AUDIENCE = process.argv.find(a=>a.startsWith('--audience='))?.split('=')[1];
const NAME = `Past guests (paid) - ${PROPERTY}`;

/** Meta wants digits only, country code included, no plus. Romanian mobiles are 40 7XX XXX XXX. */
export function normaliseRoPhone(raw: string): string | null {
  let d = (raw||'').replace(/\D/g,'');
  if (!d) return null;
  if (d.startsWith('0040')) d = d.slice(2);
  else if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0') && d.length === 10) d = '40' + d.slice(1);      // 07XXXXXXXX -> 407XXXXXXXX
  else if (d.length === 9 && d.startsWith('7')) d = '40' + d;           // 7XXXXXXXX  -> 407XXXXXXXX
  if (!d.startsWith('40')) return null;                                  // not Romanian: out of scope here
  if (d.length !== 11) return null;                                      // 40 + 9 digits
  if (!d.startsWith('407')) return null;                                 // mobile only; landlines cannot match
  return d;
}
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

(async () => {
  const db = await getAdminDb();
  const snap = await db!.collection('bookings').where('propertyId','==',PROPERTY).get();
  const seen = new Set<string>(); let rows=0, noPhone=0, rejected=0;
  for (const d of snap.docs) {
    const b:any = d.data(); rows++;
    const raw = (b.guestInfo?.phone ?? b.guestPhone ?? b.guest?.phone ?? '').toString().trim();
    if (!raw) { noPhone++; continue; }
    const n = normaliseRoPhone(raw);
    if (!n) { rejected++; continue; }
    seen.add(n);
  }
  console.log(`bookings scanned : ${rows}`);
  console.log(`  no phone       : ${noPhone}`);
  console.log(`  not a RO mobile: ${rejected}`);
  const payers = seen.size;
  if (PROSPECTS) {
    // The `guests` collection holds enquiries and leads alongside guests. These people never paid,
    // so they dilute the one thing that makes this seed worth anything. Included only on request.
    const gs = await db!.collection('guests').get();
    let added = 0;
    for (const d of gs.docs) {
      const g:any = d.data();
      const n = normaliseRoPhone((g.phone ?? '').toString());
      if (n && !seen.has(n)) { seen.add(n); added++; }
    }
    console.log(`  + prospects    : ${added} from the guests collection (never booked)`);
  }
  console.log(`  UNIQUE numbers : ${seen.size}   <- the seed${PROSPECTS ? ` (${payers} payers + ${seen.size-payers} prospects)` : ''}`);
  if (seen.size < 100) console.log(`  WARNING: Meta needs ~100 MATCHED people. Phone match rates run well under 100%, so this may not clear the floor.`);

  const hashes = [...seen].map(sha256);
  console.log(`\nhashed ${hashes.length} numbers (SHA256, raw numbers never leave this machine)`);
  console.log(`sample hash: ${hashes[0]?.slice(0,24)}...`);

  const ctx = await resolveAdContext(PROPERTY);
  if (!ctx) { console.error('no ad context'); process.exit(1); }
  const tosRes = await fetch(`https://graph.facebook.com/v25.0/${ctx.adAccountId}?fields=tos_accepted&access_token=${encodeURIComponent(ctx.token)}`);
  const tos = (await tosRes.json()).tos_accepted ?? {};
  const customerFileOk = Object.entries(tos).some(([k,v]) => /custom_audience/.test(k) && !/web_/.test(k) && v === 1);
  console.log(`\nToS on the ad account: ${JSON.stringify(tos)}`);
  if (!customerFileOk) {
    console.log('\nBLOCKED: the CUSTOMER FILE terms have not been accepted for this ad account.');
    console.log('  Business Manager -> Ad account settings, or the first time you build a customer-list');
    console.log('  audience in Ads Manager, Meta shows the terms to accept. It is one click, once.');
    console.log('  Nothing was uploaded. Re-run this after accepting.');
    process.exit(2);
  }
  if (!APPLY) { console.log('\nDry run. Nothing sent. Re-run with --apply to create and upload.'); process.exit(0); }

  let audienceId = AUDIENCE;
  if (!audienceId) {
    const create = await fetch(`https://graph.facebook.com/v25.0/${ctx.adAccountId}/customaudiences`, {
      method:'POST', body: new URLSearchParams({
        name: NAME, subtype:'CUSTOM', description:'Guests who completed a paid stay. Phone, hashed.',
        customer_file_source:'USER_PROVIDED_ONLY', access_token: ctx.token }),
    });
    const created = await create.json();
    if (!created.id) { console.error('create failed:', JSON.stringify(created).slice(0,300)); process.exit(1); }
    audienceId = created.id;
    console.log(`created audience ${audienceId}`);
  } else {
    console.log(`adding to existing audience ${audienceId} (Meta dedups, so resending is safe)`);
  }
  const up = await fetch(`https://graph.facebook.com/v25.0/${audienceId}/users`, {
    method:'POST', body: new URLSearchParams({
      payload: JSON.stringify({ schema:['PHONE'], data: hashes.map(h=>[h]) }), access_token: ctx.token }),
  });
  console.log('upload response:', JSON.stringify(await up.json()).slice(0,300));
  console.log('\nMeta takes up to ~an hour to size it. Check delivery_status before using it.');
})().catch(e=>{console.error(e);process.exit(1);});
