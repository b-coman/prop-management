#!/usr/bin/env npx tsx
/**
 * copywriter-pack — the deterministic FACT PACK the WhatsApp copywriter drafts from.
 *
 * Given a planner CampaignBrief, for EACH selected guest it assembles: their full verbatim
 * WhatsApp thread (for non-repetition + tone), their dossier, and — the crux — a `groundedFacts`
 * whitelist: the explicit list of guest-specific facts the copywriter is ALLOWED to assert, each
 * with provenance. Plus a shared voice profile (the owner's own past messages, outcome-labeled)
 * and the voice rules. Facts + method + constraints, no conclusions (plan §2 pr.5 / §7.5–7.6).
 *
 * The grounding contract (plan §7.5): the copywriter tags every guest-specific claim with a
 * groundedFacts key; validateDrafts checks factsUsed ⊆ groundedFacts. The thread is context for
 * avoiding repetition and matching tone — it is NOT a source of new assertable facts (extracting
 * checkable claims from free prose is undecidable; the whitelist is what keeps "only-true" enforceable).
 *
 * Usage:
 *   npx tsx scripts/copywriter-pack.ts --brief /tmp/brief-autumn.json --out /tmp/cw-autumn.json
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb } from '../src/lib/firebaseAdminSafe';
import { detectLanguage } from '../src/lib/growth/audience';

const arg = (n: string, d?: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : d; };
const briefFile = arg('brief'); const OUT = arg('out');
const AS_OF = new Date(`${arg('as-of', new Date().toISOString().slice(0, 10))}T00:00:00Z`);
if (!briefFile) { console.error('required: --brief <CampaignBrief.json>'); process.exit(1); }

const toD = (v: any): Date | null => v?._seconds ? new Date(v._seconds * 1000) : v?.toDate ? v.toDate() : typeof v === 'string' ? new Date(v) : v instanceof Date ? v : null;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const days = (a: Date, b: Date) => Math.round((+b - +a) / 86400000);
const seasonOf = (d: Date) => { const m = d.getUTCMonth() + 1; return m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn'; };
function lastStayPhrase(last: Date | null): string | null {
  if (!last) return null;
  const y = last.getUTCFullYear(), nowY = AS_OF.getUTCFullYear();
  const s = ({ winter: 'iarna', spring: 'primavara', summer: 'vara', autumn: 'toamna' } as any)[seasonOf(last)];
  if (last.getUTCMonth() + 1 === 12 && last.getUTCDate() >= 27) return 'de Revelion';
  return y === nowY ? `${s} aceasta` : y === nowY - 1 ? `${s} trecuta` : `in ${s} lui ${y}`;
}

async function main() {
  const brief = JSON.parse(fs.readFileSync(briefFile, 'utf8'));
  const wantIds: string[] = brief.audience.map((a: any) => a.guestId);
  const careByGuest = new Map(brief.audience.map((a: any) => [a.guestId, a.careFlags || []]));

  const db = await getAdminDb();
  const [gSnap, bSnap, rSnap, tSnap] = await Promise.all([
    db.collection('guests').get(), db.collection('bookings').get(),
    db.collection('reviews').get(), db.collection('whatsappThreads').get(),
  ]);
  const guestById = new Map(gSnap.docs.map(d => [d.id, { id: d.id, ...(d.data() as any) }]));
  const bookingById = new Map(bSnap.docs.map(d => [d.id, { id: d.id, ...(d.data() as any) }]));
  const threads = new Map(tSnap.docs.map(d => [d.id, d.data() as any]));
  const reviewsBy = new Map<string, any[]>();
  rSnap.docs.forEach(d => { const r: any = { id: d.id, ...d.data() }; if (!r.guestId) return; (reviewsBy.get(r.guestId) || reviewsBy.set(r.guestId, []).get(r.guestId)!).push(r); });

  // ── voice profile: the owner's own substantive outbound, outcome-labeled (§7.6) ──
  const owner = process.env.WHATSAPP_OWNER_NAME || 'Bogdan Coman';
  const exemplars: any[] = [];
  tSnap.docs.forEach(d => {
    const t: any = d.data(); const g = guestById.get(d.id);
    const stays = g ? (g.bookingIds || []).map((id: string) => bookingById.get(id)).filter(Boolean) : [];
    (t.messages || []).forEach((m: any, i: number) => {
      if (m.direction !== 'out' || (m.text || '').length < 260) return;
      const after = (t.messages || []).slice(i + 1);
      const replied = after.some((x: any) => x.direction === 'in' && (+new Date(x.ts) - +new Date(m.ts)) / 86400000 <= 14);
      const booked = stays.some((b: any) => { const c = toD(b.createdAt); return c && +c > +new Date(m.ts) && (+c - +new Date(m.ts)) / 86400000 <= 90; });
      exemplars.push({ text: m.text, len: (m.text || '').length, outcome: booked ? 'booked' : replied ? 'replied' : 'silent', date: String(m.ts).slice(0, 10) });
    });
  });
  // a diverse, outcome-varied set (prefer booked, then replied, then some silent; cap ~10)
  exemplars.sort((a, b) => (b.outcome === 'booked' ? 1 : 0) - (a.outcome === 'booked' ? 1 : 0) || b.len - a.len);
  const voiceExemplars = [
    ...exemplars.filter(e => e.outcome === 'booked').slice(0, 3),
    ...exemplars.filter(e => e.outcome === 'replied').slice(0, 5),
    ...exemplars.filter(e => e.outcome === 'silent').slice(0, 2),
  ].map(e => ({ outcome: e.outcome, date: e.date, text: e.text }));

  // ── per-guest packs ──
  const guests = wantIds.map(gid => {
    const g: any = guestById.get(gid);
    if (!g) return { guestId: gid, error: 'guest not found' };
    const stayB = (g.bookingIds || []).map((id: string) => bookingById.get(id)).filter(Boolean)
      .filter((b: any) => b.status !== 'cancelled' && toD(b.checkInDate) && toD(b.checkInDate)! < AS_OF)
      .sort((a: any, b: any) => +toD(a.checkInDate)! - +toD(b.checkInDate)!);
    const lastBk: any = stayB.length ? stayB[stayB.length - 1] : null;
    const last = lastBk ? toD(lastBk.checkInDate) : null;
    const rv = reviewsBy.get(gid) || [];
    const reviewThemes = [...new Set(rv.flatMap((r: any) => { const t = r.tags; return Array.isArray(t) ? t : t && typeof t === 'object' ? Object.values(t).flat() : []; }))]
      .filter(x => typeof x === 'string' && !/^\+\d+ more$/i.test(x));  // drop the "+N more" truncation artifact
    const th = threads.get(gid);
    const thread = ((th?.messages || []) as any[]).filter(m => m.ts < ymd(AS_OF)).map(m => ({ ts: m.ts, dir: m.direction, text: m.text }));
    const totalBookings = g.totalBookings ?? stayB.length;
    // which language to actually WRITE in — detected from the thread, because the `language` field
    // is a blanket "ro" default across the base and does not reflect how the guest communicates.
    const threadText = thread.map(m => m.text || '').join(' ');
    const detected = detectLanguage(threadText);
    const writeLanguage = detected === 'unknown' ? (g.language || 'ro') : detected;

    // groundedFacts — the assertable whitelist (structured facts only; provenance attached).
    const groundedFacts: any[] = [];
    if (g.firstName) groundedFacts.push({ key: 'firstName', value: g.firstName, source: `guests/${gid}` });
    if (last) groundedFacts.push({ key: 'lastStayPhrase', value: lastStayPhrase(last), source: `bookings/${lastBk.id}` });
    if (last) groundedFacts.push({ key: 'lastStaySeason', value: seasonOf(last), source: `bookings/${lastBk.id}` });
    if (lastBk?.numberOfGuests) groundedFacts.push({ key: 'partySize', value: lastBk.numberOfGuests, source: `bookings/${lastBk.id}` });
    if (lastBk && (lastBk.numberOfChildren ?? 0) > 0) groundedFacts.push({ key: 'hadChildren', value: true, source: `bookings/${lastBk.id}` });
    if (totalBookings >= 2) groundedFacts.push({ key: 'isRepeatGuest', value: totalBookings, source: `guests/${gid}` });
    reviewThemes.forEach(t => groundedFacts.push({ key: `reviewPraised:${t}`, value: t, source: `reviews/${(rv[0] || {}).id || gid}` }));
    // NOTE: no `issueResolved:*` facts are emitted here — the pack cannot know a problem was fixed.
    // Those are owner-supplied (a future input); until then a complaint guest gets neutral treatment.

    return {
      guestId: gid,
      firstName: g.firstName || null,
      writeLanguage,                          // WRITE in this (thread-detected); the field is unreliable
      recordLanguage: g.language || null,     // for reference only — blanket "ro", do not trust
      threadLanguageDetected: detected,
      careFlags: careByGuest.get(gid) || [],
      dossier: {
        tier: totalBookings >= 2 ? 'repeat' : 'single',
        totalBookings,
        lastStay: last ? ymd(last) : null,
        lastStayPhrase: lastStayPhrase(last),
        lastStaySeason: last ? seasonOf(last) : null,
        partySize: lastBk?.numberOfGuests ?? null,
        hadChildren: lastBk ? (lastBk.numberOfChildren ?? 0) > 0 : null,
        reviewThemes,
      },
      groundedFacts,
      thread,
      threadNote: thread.length ? `${thread.length} prior messages — read to AVOID repeating what was already said, and to match tone. Do NOT assert a new guest-specific fact from the thread that is not in groundedFacts.` : 'no prior WhatsApp history — a first contact; include the opt-out line.',
    };
  });

  const pack = {
    meta: { generatedFor: brief.propertyId, asOf: ymd(AS_OF), generator: 'scripts/copywriter-pack.ts', briefId: brief.opportunity?.id },
    campaign: { occasion: brief.occasion, offer: brief.offer, intent: brief.intent, generalAngle: brief.generalAngle },
    voiceProfile: {
      note: 'Imitate this register — these are the owner\'s REAL past messages, tagged by outcome (booked/replied/silent). Copy the voice, not the content. Prefer what "booked".',
      exemplars: voiceExemplars,
    },
    voiceRules: {
      language: 'Write each message in that guest\'s writeLanguage (thread-detected: "ro" or "en"). Romanian is written WITHOUT diacritics (matches the owner). Do NOT trust recordLanguage — it is a blanket "ro" default. An English-speaking expat living here (RO phone) gets an English message.',
      length: '300–600 characters, 3–6 short sentences',
      noEmoji: true,
      selfIdRequired: 'open by identifying the sender (e.g. "Bogdan sunt, de la casuta din Comarnic")',
      optOut: 'include a soft opt-out line only on a FIRST contact (no prior thread); otherwise rely on WhatsApp block/report',
      grounding: 'assert ONLY facts present in that guest\'s groundedFacts; tag each claim in factsUsed with its key. No emoji. No invented stays/preferences.',
      sentiment: 'always positive. For a careFlag complaint: if (and only if) an issueResolved:* fact is present, you MAY add a warm PS acknowledging the fix; otherwise do NOT mention the past problem at all — write a normal forward-looking message.',
    },
    guests,
  };

  const json = JSON.stringify(pack, null, 2);
  if (OUT) { fs.writeFileSync(OUT, json); console.error(`wrote ${OUT} (${Math.round(json.length / 1024)} KB) · ${guests.length} guests · ${voiceExemplars.length} voice exemplars`); }
  else console.log(json);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
