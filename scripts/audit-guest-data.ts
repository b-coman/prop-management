#!/usr/bin/env npx tsx
/**
 * audit-guest-data — data-quality audit of the reactivation audience, prompted by two issues the
 * copywriter surfaced on a live draft run: a foreign guest filed as Romanian (Artem), and a
 * firstName that disagrees with how the owner addresses the guest in-thread (Nica vs "Cristi").
 *
 * Read-only. Reports the guests to fix before a real send; changes nothing.
 *
 * Usage: npx tsx scripts/audit-guest-data.ts [--property prahova-mountain-chalet]
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb } from '../src/lib/firebaseAdminSafe';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const PROPERTY = arg('property', 'prahova-mountain-chalet')!;
const toD = (v: any): Date | null => v?._seconds ? new Date(v._seconds * 1000) : v?.toDate ? v.toDate() : typeof v === 'string' ? new Date(v) : null;

// crude language sniff: Romanian vs English by stopword hits.
const RO = /\b(si|sa|va|nu|ca|la|cu|de|pe|este|sunt|multumesc|buna|ziua|zile|casa|casuta|noapte|rezervare)\b/gi;
const EN = /\b(the|and|you|for|are|is|we|thanks|thank|hello|hi|please|room|night|booking|stay|great)\b/gi;

async function main() {
  const db = await getAdminDb();
  const [gSnap, bSnap, tSnap] = await Promise.all([
    db.collection('guests').get(), db.collection('bookings').get(), db.collection('whatsappThreads').get(),
  ]);
  const bookingById = new Map(bSnap.docs.map(d => [d.id, { id: d.id, ...(d.data() as any) }]));
  const threads = new Map(tSnap.docs.map(d => [d.id, d.data() as any]));
  const owner = (process.env.WHATSAPP_OWNER_NAME || 'Bogdan Coman').split(' ')[0];

  const guests = gSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })).filter(g => (g.propertyIds || []).includes(PROPERTY));
  const isROclass = (g: any) => (g.language || '').toLowerCase() === 'ro' || ['RO', 'ROMANIA'].includes(String(g.country || '').toUpperCase());
  const reachable = guests.filter(g => g.normalizedPhone && !g.unsubscribed);
  const roClass = reachable.filter(isROclass);

  console.log(`=== reactivation audience: ${roClass.length} RO-classified of ${reachable.length} reachable (property ${PROPERTY}) ===\n`);

  // 1. classification basis — language tag vs country
  const langOnly = roClass.filter(g => (g.language || '').toLowerCase() === 'ro' && !['RO', 'ROMANIA'].includes(String(g.country || '').toUpperCase()));
  console.log(`1. CLASSIFIED RO BY LANGUAGE TAG BUT COUNTRY IS NOT RO: ${langOnly.length}`);
  langOnly.forEach(g => console.log(`   ${g.id.slice(0, 8)} ${(g.firstName || '?').padEnd(12)} country=${g.country || '(none)'}`));

  // 2. foreign-looking threads (owner or guest writing in English) among RO-classified
  console.log(`\n2. RO-CLASSIFIED GUESTS WHOSE THREAD LOOKS ENGLISH (likely foreign, mis-filed):`);
  let foreignThread = 0;
  for (const g of roClass) {
    const t = threads.get(g.id); const msgs = (t?.messages || []) as any[];
    if (msgs.length < 3) continue;
    const text = msgs.map(m => m.text || '').join(' ');
    const ro = (text.match(RO) || []).length, en = (text.match(EN) || []).length;
    if (en > ro && en >= 5) { foreignThread++; console.log(`   ${g.id.slice(0, 8)} ${(g.firstName || '?').padEnd(12)} country=${g.country || '?'} · EN hits ${en} vs RO ${ro} · ${msgs.length} msgs`); }
  }
  if (!foreignThread) console.log('   (none)');

  // 3. name mismatch: how the owner addresses them ("Buna X") vs guest.firstName
  console.log(`\n3. NAME MISMATCH (owner writes "Buna <X>" ≠ guest.firstName):`);
  let mism = 0;
  for (const g of roClass) {
    const t = threads.get(g.id); const msgs = (t?.messages || []) as any[];
    const greetings = msgs.filter(m => m.direction === 'out').map(m => (m.text || '').match(/\b(?:buna|salut|hei|hello|hi)\b[\s,!]+([A-ZȘȚĂÎÂ][a-zșțăîâ]+)/i)).filter(Boolean).map((x: any) => x[1]);
    const addressed = [...new Set(greetings)];
    const fn = (g.firstName || '').trim();
    if (fn && addressed.length && !addressed.some((a: string) => a.toLowerCase() === fn.toLowerCase()) && !addressed.some((a: string) => a.toLowerCase() === owner.toLowerCase())) {
      mism++; console.log(`   ${g.id.slice(0, 8)} record="${fn}" · addressed as ${JSON.stringify(addressed)}`);
    }
  }
  if (!mism) console.log('   (none)');

  // 4. foreign repeat guests — the exceptions to "foreigners don't return"
  console.log(`\n4. FOREIGN REPEAT GUESTS (2+ stays, country not RO) — exceptions to the RO-only rule:`);
  let fr = 0;
  for (const g of guests) {
    if (isROclass(g)) continue;
    const stays = (g.bookingIds || []).map((id: string) => bookingById.get(id)).filter((b: any) => b && b.status !== 'cancelled' && toD(b.checkInDate)).length;
    if (stays >= 2) { fr++; console.log(`   ${g.id.slice(0, 8)} ${(g.firstName || '?').padEnd(12)} country=${g.country || '?'} · ${stays} stays`); }
  }
  if (!fr) console.log('   (none)');

  console.log(`\n=== SUMMARY ===`);
  console.log(`  RO-classified reachable: ${roClass.length}`);
  console.log(`  ├ by language tag only (country not RO): ${langOnly.length}  ← verify these are really Romanian`);
  console.log(`  ├ thread looks English (likely foreign): ${foreignThread}  ← fix classification before a real send`);
  console.log(`  └ name mismatch vs thread: ${mism}  ← fix firstName before a real send`);
  console.log(`  Foreign repeat guests (out of RO scope today): ${fr}  ← decision: is reactivation "RO-only" or "RO + any repeat"?`);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
