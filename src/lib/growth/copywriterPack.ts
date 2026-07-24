/**
 * copywriterPack — builds the deterministic FACT PACK the WhatsApp copywriter drafts from, for a
 * given CampaignBrief (the framing). Shared by the CLI (scripts/copywriter-pack.ts) and the in-app
 * copywriter (src/services/growth/copywriter.ts) so both reason from the SAME facts.
 *
 * For each selected guest it assembles: the full verbatim WhatsApp thread (tone + non-repetition),
 * a dossier (incl. booking-channel history), the `applicableUpdates` (campaign news date-filtered to
 * guests it's genuinely new for), and the `groundedFacts` whitelist — the explicit list of guest-
 * specific facts the copywriter may assert (validateDrafts enforces factsUsed ⊆ groundedFacts).
 * Plus the shared voice profile (owner's own past messages, outcome-labeled) and voice rules.
 * Facts + method + constraints, no conclusions (plan §2 pr.5 / §7.5–7.6).
 *
 * Server-only (uses the Admin SDK).
 */
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { detectLanguage } from '@/lib/growth/audience';
import type { CampaignBrief } from '@/lib/growth/contracts';

const toD = (v: any): Date | null => v?._seconds ? new Date(v._seconds * 1000) : v?.toDate ? v.toDate() : typeof v === 'string' ? new Date(v) : v instanceof Date ? v : null;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const days = (a: Date, b: Date) => Math.round((+b - +a) / 86400000);
const seasonOf = (d: Date) => { const m = d.getUTCMonth() + 1; return m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn'; };
function lastStayPhrase(last: Date | null, asOf: Date): string | null {
  if (!last) return null;
  const y = last.getUTCFullYear(), nowY = asOf.getUTCFullYear();
  const s = ({ winter: 'iarna', spring: 'primavara', summer: 'vara', autumn: 'toamna' } as any)[seasonOf(last)];
  if (last.getUTCMonth() + 1 === 12 && last.getUTCDate() >= 27) return 'de Revelion';
  return y === nowY ? `${s} aceasta` : y === nowY - 1 ? `${s} trecuta` : `in ${s} lui ${y}`;
}

export interface CopywriterPack {
  meta: { generatedFor: string; asOf: string; generator: string; briefId?: string };
  campaign: { occasion: unknown; offer: unknown; updates: unknown[]; intent: string; generalAngle: string };
  voiceProfile: { note: string; exemplars: Array<{ outcome: string; date: string; text: string }> };
  voiceRules: Record<string, unknown>;
  guests: any[];
}

/** Build the copywriter fact pack for a brief. `asOf` defaults to now (UTC midnight). */
export async function buildCopywriterPack(brief: CampaignBrief, opts?: { asOf?: Date; ownerName?: string }): Promise<CopywriterPack> {
  const AS_OF = opts?.asOf ?? new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const wantIds: string[] = brief.audience.map((a) => a.guestId);
  const careByGuest = new Map(brief.audience.map((a) => [a.guestId, a.careFlags || []]));
  const framingUpdates: any[] = brief.updates || [];

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
  const exemplars: any[] = [];
  tSnap.docs.forEach(d => {
    const t: any = d.data(); const g = guestById.get(d.id);
    const stays = g ? ((g as any).bookingIds || []).map((id: string) => bookingById.get(id)).filter(Boolean) : [];
    (t.messages || []).forEach((m: any, i: number) => {
      if (m.direction !== 'out' || (m.text || '').length < 260) return;
      const after = (t.messages || []).slice(i + 1);
      const replied = after.some((x: any) => x.direction === 'in' && (+new Date(x.ts) - +new Date(m.ts)) / 86400000 <= 14);
      const booked = stays.some((b: any) => { const c = toD(b.createdAt); return c && +c > +new Date(m.ts) && (+c - +new Date(m.ts)) / 86400000 <= 90; });
      exemplars.push({ text: m.text, len: (m.text || '').length, outcome: booked ? 'booked' : replied ? 'replied' : 'silent', date: String(m.ts).slice(0, 10) });
    });
  });
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
    const channels = stayB.map((b: any) => String(b.source || '').toLowerCase()).filter(Boolean);
    const directCount = channels.filter((c: string) => c === 'direct').length;
    const otaCount = channels.length - directCount;
    const lastChannel = channels.length ? channels[channels.length - 1] : null;
    const booksDirect = directCount > 0;
    const applicableUpdates = framingUpdates.filter((u: any) => {
      const eff = toD(u.effectiveDate); return eff && last && +last < +eff;
    }).map((u: any) => ({ id: u.id, text: u.text }));
    const rv = reviewsBy.get(gid) || [];
    const reviewThemes = [...new Set(rv.flatMap((r: any) => { const t = r.tags; return Array.isArray(t) ? t : t && typeof t === 'object' ? Object.values(t).flat() : []; }))]
      .filter(x => typeof x === 'string' && !/^\+\d+ more$/i.test(x)) as string[];
    const th = threads.get(gid);
    const thread = ((th?.messages || []) as any[]).filter(m => m.ts < ymd(AS_OF)).map(m => ({ ts: m.ts, dir: m.direction, text: m.text }));
    const totalBookings = g.totalBookings ?? stayB.length;
    const threadText = thread.map(m => m.text || '').join(' ');
    const detected = detectLanguage(threadText);
    const writeLanguage = detected === 'unknown' ? (g.language || 'ro') : detected;

    // Relationship state — so the copywriter continues the conversation instead of cold-opening,
    // and decides self-ID / opt-out from the REAL history (facts; the LLM judges from these).
    const inboundCount = thread.filter(m => m.dir === 'in').length;
    const lastExchange = thread.length ? String(thread[thread.length - 1].ts).slice(0, 10) : null;
    const daysSinceLastExchange = lastExchange ? days(new Date(`${lastExchange}T00:00:00Z`), AS_OF) : null;
    const relationshipState =
      thread.length === 0 ? 'first-contact'                       // never messaged
      : inboundCount === 0 ? 'silent'                              // messaged before, never replied
      : (daysSinceLastExchange ?? 999) <= 120 ? 'active'          // replied + spoke recently
      : 'lapsed';                                                 // replied before, but long ago
    const relationship = { state: relationshipState, totalMessages: thread.length, replies: inboundCount, lastExchange, daysSinceLastExchange };

    const groundedFacts: any[] = [];
    if (g.firstName) groundedFacts.push({ key: 'firstName', value: g.firstName, source: `guests/${gid}` });
    if (g.partnerName) groundedFacts.push({ key: 'partnerName', value: g.partnerName, source: `guests/${gid}` });
    if (last) groundedFacts.push({ key: 'lastStayPhrase', value: lastStayPhrase(last, AS_OF), source: `bookings/${lastBk.id}` });
    if (last) groundedFacts.push({ key: 'lastStaySeason', value: seasonOf(last), source: `bookings/${lastBk.id}` });
    if (lastBk?.numberOfGuests) groundedFacts.push({ key: 'partySize', value: lastBk.numberOfGuests, source: `bookings/${lastBk.id}` });
    if (lastBk && (lastBk.numberOfChildren ?? 0) > 0) groundedFacts.push({ key: 'hadChildren', value: true, source: `bookings/${lastBk.id}` });
    if (totalBookings >= 2) groundedFacts.push({ key: 'isRepeatGuest', value: totalBookings, source: `guests/${gid}` });
    if (booksDirect) groundedFacts.push({ key: 'booksDirect', value: { directBookings: directCount, otaBookings: otaCount }, source: `bookings(guests/${gid})` });
    reviewThemes.forEach(t => groundedFacts.push({ key: `reviewPraised:${t}`, value: t, source: `reviews/${(rv[0] || {}).id || gid}` }));
    applicableUpdates.forEach((u: any) => groundedFacts.push({ key: `update:${u.id}`, value: u.text, source: 'campaign.updates' }));

    return {
      guestId: gid,
      firstName: g.firstName || null,
      writeLanguage,
      recordLanguage: g.language || null,
      threadLanguageDetected: detected,
      careFlags: careByGuest.get(gid) || [],
      relationship,
      dossier: {
        tier: totalBookings >= 2 ? 'repeat' : 'single',
        totalBookings,
        lastStay: last ? ymd(last) : null,
        lastStayPhrase: lastStayPhrase(last, AS_OF),
        lastStaySeason: last ? seasonOf(last) : null,
        partySize: lastBk?.numberOfGuests ?? null,
        hadChildren: lastBk ? (lastBk.numberOfChildren ?? 0) > 0 : null,
        reviewThemes,
        bookingChannel: { lastChannel, directCount, otaCount },
      },
      applicableUpdates,
      groundedFacts,
      thread,
      threadNote: thread.length ? `${thread.length} prior messages — read to AVOID repeating what was already said, and to match tone. Do NOT assert a new guest-specific fact from the thread that is not in groundedFacts.` : 'no prior WhatsApp history — a first contact; include the opt-out line.',
    };
  });

  return {
    meta: { generatedFor: brief.propertyId, asOf: ymd(AS_OF), generator: 'src/lib/growth/copywriterPack.ts', briefId: brief.opportunity?.id },
    campaign: { occasion: brief.occasion, offer: brief.offer, updates: framingUpdates, intent: brief.intent, generalAngle: brief.generalAngle },
    voiceProfile: {
      note: 'Imitate this register — these are the owner\'s REAL past messages, tagged by outcome (booked/replied/silent). Copy the voice, not the content. Prefer what "booked".',
      exemplars: voiceExemplars,
    },
    voiceRules: {
      language: 'Write each message in that guest\'s writeLanguage (thread-detected: "ro" or "en"). Romanian is written WITHOUT diacritics (matches the owner). Do NOT trust recordLanguage — it is a blanket "ro" default. An English-speaking expat living here (RO phone) gets an English message.',
      register: 'Pick ONE register per message and keep it consistent throughout — either tu (informal: tu/iti/te/ai) OR voi/dumneavoastra (formal: voi/va/ati). NEVER mix them in the same message (not even "ati fost… iti dau"). Choose per guest: if there is a prior thread, match how the owner addressed them there; if there is NO prior thread (a first contact), use polite voi (you do not address a stranger with tu); otherwise default to the warm informal tu.',
      length: '300–600 characters, 3–6 short sentences',
      emoji: 'Use emoji SPARINGLY — at most one or two in a message, only to underline a warm note (a 🍂 for autumn, a 😉 for a wink, a ;) like the owner does), never decorative, never several in a row. Match the owner\'s real light touch; when in doubt, none.',
      continuity: 'These are ONGOING relationships, not cold sends. READ the guest\'s `thread` and `relationship` and continue it naturally — pick up where you left off, and where it fits, nod to the last exchange. NEVER re-say something the thread shows you already told them (see `updates`). Use `relationship.state`: "active" (replied, spoke ≤120d ago) → continue warmly, do NOT re-introduce yourself; "lapsed" (replied before, long ago) → a light reconnect ("a trecut ceva vreme"); "silent" (messaged, never replied) → a fresh, low-pressure note; "first-contact" (no thread) → introduce yourself.',
      selfId: 'Identify yourself ("Bogdan sunt, de la casuta din Comarnic") ONLY when it helps — a first-contact, a "lapsed"/"silent" state, or a long gap. For an "active" recent thread they know who you are; opening with a re-introduction reads as a form letter — just continue. (Self-ID must still appear somewhere for a first/cold contact — the validator checks it there.)',
      partnerGreeting: 'If a `partnerName` grounded fact is present, the WhatsApp number belongs to that partner (who booked under the guest firstName) — greet BOTH warmly, e.g. "Buna Razvan si Loredana!", and tag `partnerName` in factsUsed. If there is no partnerName, greet only by firstName.',
      optOut: 'Give a graceful, low-pressure way out to a FIRST contact AND to a "silent" guest (messaged before, never replied) — e.g. "daca preferi sa nu-ti mai scriu, spune-mi". An "active"/"lapsed" guest who has replied does NOT need one — it would be odd. Use judgment from `relationship.state`.',
      grounding: 'assert ONLY facts present in that guest\'s groundedFacts; tag each claim in factsUsed with its key. No emoji. No invented stays/preferences.',
      offerPresentation: 'The offer (campaign.offer) is set by the owner — never inflate or invent one, only phrase it. Adapt HOW you present it per guest: a guest with a `booksDirect` fact already knows they get your best price directly, so acknowledge that warmly (e.g. "si asa cum stii deja, iti pot da cea mai buna oferta direct") rather than quoting a discount as if it were news; a guest who has only booked via an OTA gets the explicit offer. For a free-night/value offer, describe the value in words, not a bare percentage. Tag `booksDirect` in factsUsed when you use that angle.',
      updates: 'Each guest\'s `applicableUpdates` lists campaign news new SINCE THAT guest\'s last stay (date-filtered). BUT before mentioning one, CHECK the thread: if you already told this guest about it in a previous message, do NOT re-announce it as "noutate" — either build on it ("cum ti-am zis, avem acum…") or leave it out; mention only the part that is genuinely new to them. Decide per guest whether it is worth raising at all — do not force it into every message. You may mention ONLY updates in that guest\'s applicableUpdates, tagging factsUsed with the `update:<id>` key.',
      sentiment: 'always positive. For a careFlag complaint: if (and only if) an issueResolved:* fact is present, you MAY add a warm PS acknowledging the fix; otherwise do NOT mention the past problem at all — write a normal forward-looking message.',
    },
    guests,
  };
}
