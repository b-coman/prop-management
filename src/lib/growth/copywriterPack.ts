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
import { getNotesByGuest, isTouch, isLive } from '@/services/guestNoteService';
import { effectiveDiscountPct, type CampaignBrief } from '@/lib/growth/contracts';
import { normalizeChannel, CHANNEL_LABELS, type ChannelId } from '@/lib/channels';
import { hadChildren } from '@/lib/occupancy';
import { quoteStay } from '@/lib/pricing/quote-stay';
import { parseISO } from 'date-fns';

const toD = (v: any): Date | null => v?._seconds ? new Date(v._seconds * 1000) : v?.toDate ? v.toDate() : typeof v === 'string' ? new Date(v) : v instanceof Date ? v : null;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const days = (a: Date, b: Date) => Math.round((+b - +a) / 86400000);

// Voice-exemplar filters (owner request 2026-07-24): EXCLUDE operational messages (directions,
// check-in access, heating/water troubleshooting) from the voice pool — they are not the warm
// reactivation register we want modeled; and PREFER outreach/reactivation messages within the pool.
const VOICE_LOGISTICS = /waze|goo\.gl\/maps|maps\.app|maps\.google|google maps|plus code|localizare|check[\s-]?in|codul de acces|cheia|drum bun|\bharta\b|calorifer|presiune|termometru|temperatur/i;
const VOICE_OUTREACH = /perioada liber|fereastra liber|s-a eliberat|s-a deschis|\bmi s-a\b|anulare|revii|reveni|prima ocazie|imi aduc aminte|mi-am adus aminte|va doriti|oferta|weekendul asta liber/i;
// A past message that quotes a discount. When the campaign has no discount these are dropped from
// the voice pool: the model copies content from exemplars despite being told not to (Sep 2026 it
// wrote "10% direct fata de pretul de pe platforme" into a no-discount campaign).
const VOICE_DISCOUNT = /\d+\s*(%|la\s*suta)|reducere|discount/i;
const seasonOf = (d: Date) => { const m = d.getUTCMonth() + 1; return m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : 'autumn'; };
function lastStayPhrase(last: Date | null, asOf: Date): string | null {
  if (!last) return null;
  const y = last.getUTCFullYear(), nowY = asOf.getUTCFullYear();
  const s = ({ winter: 'iarna', spring: 'primavara', summer: 'vara', autumn: 'toamna' } as any)[seasonOf(last)];
  if (last.getUTCMonth() + 1 === 12 && last.getUTCDate() >= 27) return 'de Revelion';
  // A winter spans the new year, so count winters by the December they start in. A Jan 2026 stay,
  // read in Sep 2026, is "iarna trecuta" (the winter of Dec 2025), not "iarna aceasta".
  if (seasonOf(last) === 'winter') {
    const winterOf = (d: Date) => d.getUTCMonth() + 1 <= 2 ? d.getUTCFullYear() - 1 : d.getUTCFullYear();
    // Outside winter, "this winter" would be the one starting this December.
    const back = (seasonOf(asOf) === 'winter' ? winterOf(asOf) : asOf.getUTCFullYear()) - winterOf(last);
    return back === 0 ? 'iarna aceasta' : back === 1 ? 'iarna trecuta' : `in iarna lui ${y}`;
  }
  return y === nowY ? `${s} aceasta` : y === nowY - 1 ? `${s} trecuta` : `in ${s} lui ${y}`;
}

export interface CopywriterPack {
  meta: { generatedFor: string; asOf: string; generator: string; briefId?: string };
  campaign: { occasion: unknown; offer: unknown; updates: unknown[]; intent: string; generalAngle: string; masterMessage: string | null; stay: { checkIn: string; checkOut: string } | null };
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
  const [gSnap, bSnap, rSnap, tSnap, notesByGuest] = await Promise.all([
    db.collection('guests').get(), db.collection('bookings').get(),
    db.collection('reviews').get(), db.collection('whatsappThreads').get(),
    getNotesByGuest(),
  ]);
  const guestById = new Map(gSnap.docs.map(d => [d.id, { id: d.id, ...(d.data() as any) }]));
  const bookingById = new Map(bSnap.docs.map(d => [d.id, { id: d.id, ...(d.data() as any) }]));
  const threads = new Map(tSnap.docs.map(d => [d.id, d.data() as any]));
  const reviewsBy = new Map<string, any[]>();
  rSnap.docs.forEach(d => { const r: any = { id: d.id, ...d.data() }; if (!r.guestId) return; (reviewsBy.get(r.guestId) || reviewsBy.set(r.guestId, []).get(r.guestId)!).push(r); });

  // ── voice profile: the owner's own substantive outbound, outcome-labeled (§7.6) ──
  const exemplars: any[] = [];
  const campaignHasDiscount = effectiveDiscountPct(brief.offer) !== 0 && brief.intent !== 'share';
  tSnap.docs.forEach(d => {
    const t: any = d.data(); const g = guestById.get(d.id);
    const stays = g ? ((g as any).bookingIds || []).map((id: string) => bookingById.get(id)).filter(Boolean) : [];
    (t.messages || []).forEach((m: any, i: number) => {
      const text = m.text || '';
      if (m.direction !== 'out' || text.length < 260) return;
      if (VOICE_LOGISTICS.test(text)) return;   // strip directions / check-in / troubleshooting from the voice pool
      if (!campaignHasDiscount && VOICE_DISCOUNT.test(text)) return;
      const after = (t.messages || []).slice(i + 1);
      const replied = after.some((x: any) => x.direction === 'in' && (+new Date(x.ts) - +new Date(m.ts)) / 86400000 <= 14);
      const booked = stays.some((b: any) => { const c = toD(b.createdAt); return c && +c > +new Date(m.ts) && (+c - +new Date(m.ts)) / 86400000 <= 90; });
      exemplars.push({ text, len: text.length, outcome: booked ? 'booked' : replied ? 'replied' : 'silent', date: String(m.ts).slice(0, 10), isOutreach: VOICE_OUTREACH.test(text) });
    });
  });
  // Within each outcome bucket, prefer warm OUTREACH/reactivation messages, then the longer ones.
  const rank = (arr: any[]) => arr.sort((a, b) => (b.isOutreach ? 1 : 0) - (a.isOutreach ? 1 : 0) || b.len - a.len);
  const voiceExemplars = [
    ...rank(exemplars.filter(e => e.outcome === 'booked')).slice(0, 3),
    ...rank(exemplars.filter(e => e.outcome === 'replied')).slice(0, 5),
    ...rank(exemplars.filter(e => e.outcome === 'silent')).slice(0, 2),
  ].map(e => ({ outcome: e.outcome, date: e.date, text: String(e.text).replace(/^\d+\s*kB\s+/, '').trim() })); // strip scrape file-size artifacts

  // ── the site's own price for the campaign stay, per party size ──
  // Quoted through quoteStay, the same function the booking page uses, so a message can never name a
  // price the site won't honour. Computed once per distinct party size among the selected guests.
  const priceByParty = new Map<number, number>();
  if (brief.stay?.checkIn && brief.stay?.checkOut) {
    const sizes = new Set<number>();
    wantIds.forEach(gid => {
      const g: any = guestById.get(gid);
      const last = (g?.bookingIds || []).map((id: string) => bookingById.get(id)).filter((b: any) => b && b.status !== 'cancelled' && toD(b.checkInDate) && toD(b.checkInDate)! < AS_OF)
        .sort((a: any, b: any) => +toD(a.checkInDate)! - +toD(b.checkInDate)!).pop();
      if (last?.numberOfGuests) sizes.add(Number(last.numberOfGuests));
    });
    await Promise.all([...sizes].map(async (n) => {
      const q = await quoteStay({ propertyId: brief.propertyId, checkIn: parseISO(brief.stay!.checkIn), checkOut: parseISO(brief.stay!.checkOut), adults: n, children: 0, hasSplit: false });
      if (q.available) priceByParty.set(n, Math.round(q.pricing.total));
    }));
  }

  // ── per-guest packs ──
  const guests = wantIds.map(gid => {
    const g: any = guestById.get(gid);
    if (!g) return { guestId: gid, error: 'guest not found' };
    const stayB = (g.bookingIds || []).map((id: string) => bookingById.get(id)).filter(Boolean)
      .filter((b: any) => b.status !== 'cancelled' && toD(b.checkInDate) && toD(b.checkInDate)! < AS_OF)
      .sort((a: any, b: any) => +toD(a.checkInDate)! - +toD(b.checkInDate)!);
    const lastBk: any = stayB.length ? stayB[stayB.length - 1] : null;
    const last = lastBk ? toD(lastBk.checkInDate) : null;
    // Normalised: `booksDirect` decides how the copy may talk to this guest, and a guest whose
    // booking still says `website-pending` books direct just as much as one that says `direct`.
    const channels = stayB.map((b: any) => normalizeChannel(b.source) ?? String(b.source || '').toLowerCase()).filter(Boolean);
    const directCount = channels.filter((c: string) => c === 'direct').length;
    const otaCount = channels.length - directCount;
    const lastChannel = channels.length ? channels[channels.length - 1] : null;
    const booksDirect = directCount > 0;
    // The OTA an OTA-only guest actually used, for "now you can book directly with me". Only a real
    // OTA from CHANNEL_LABELS; 'direct' never qualifies.
    const pastOtaChannel = !booksDirect && lastChannel && lastChannel !== 'direct' && (CHANNEL_LABELS as Record<string, string>)[lastChannel as ChannelId]
      ? (CHANNEL_LABELS as Record<string, string>)[lastChannel as ChannelId] : null;
    const applicableUpdates = framingUpdates.filter((u: any) => {
      const eff = toD(u.effectiveDate); return eff && last && +last < +eff;
    }).map((u: any) => ({ id: u.id, text: u.text }));
    const rv = reviewsBy.get(gid) || [];
    const reviewThemes = [...new Set(rv.flatMap((r: any) => { const t = r.tags; return Array.isArray(t) ? t : t && typeof t === 'object' ? Object.values(t).flat() : []; }))]
      .filter(x => typeof x === 'string' && !/^\+\d+ more$/i.test(x)) as string[];
    const th = threads.get(gid);
    const thread = ((th?.messages || []) as any[]).filter(m => m.ts < ymd(AS_OF)).map(m => ({ ts: m.ts, dir: m.direction, text: m.text }));
    const totalBookings = stayB.length;   // REAL completed (non-cancelled, past) stays — g.totalBookings is unreliable (inflated; e.g. Roy Levi shows 2 with one cancelled booking), so never claim "repeat" from it
    const threadText = thread.map(m => m.text || '').join(' ');
    const detected = detectLanguage(threadText);
    const writeLanguage = detected === 'unknown' ? (g.language || 'ro') : detected;

    // Off-WhatsApp interactions (phone calls above all), live as of AS_OF.
    const notes = (notesByGuest.get(gid) || []).filter(n => n.occurredAt <= ymd(AS_OF) && isLive(n, ymd(AS_OF)));
    const touches = notes.filter(n => isTouch(n.kind));           // calls / in-person = real exchanges

    // Relationship state — so the copywriter continues the conversation instead of cold-opening,
    // and decides self-ID / opt-out from the REAL history (facts; the LLM judges from these).
    // Computed across BOTH channels: judging engagement from WhatsApp alone inverts the read on a
    // phone-first relationship — unanswered outbound messages look like "silent, never replied"
    // for someone who was warm on a call. A logged call is proof of engagement.
    const inboundCount = thread.filter(m => m.dir === 'in').length;
    const lastMessageDate = thread.length ? String(thread[thread.length - 1].ts).slice(0, 10) : null;
    const lastTouch = touches.length ? touches[touches.length - 1] : null;
    const lastExchange = [lastMessageDate, lastTouch?.occurredAt].filter(Boolean).sort().pop() ?? null;
    const lastExchangeVia = lastExchange && lastTouch?.occurredAt === lastExchange ? lastTouch.kind : lastExchange ? 'whatsapp' : null;
    const daysSinceLastExchange = lastExchange ? days(new Date(`${lastExchange}T00:00:00Z`), AS_OF) : null;
    const engaged = inboundCount > 0 || touches.length > 0;       // they have actually engaged with us
    const relationshipState =
      thread.length === 0 && notes.length === 0 ? 'first-contact' // no history at all
      : !engaged ? 'silent'                                        // contacted before, never engaged
      : (daysSinceLastExchange ?? 999) <= 120 ? 'active'          // engaged + spoke recently
      : 'lapsed';                                                 // engaged before, but long ago
    const relationship = {
      state: relationshipState, totalMessages: thread.length, replies: inboundCount,
      calls: touches.length, lastExchange, lastExchangeVia, daysSinceLastExchange,
    };

    // A LEAD asked for something and it did not happen. That request — and the reason — is the only
    // specific material a message to them can honestly be built on; there is no stay, no season, no
    // review, no booking channel. See NonConversionReason for what each reason licenses.
    const kind: 'guest' | 'lead' = g.kind === 'lead' ? 'lead' : 'guest';
    const nameSource = g.nameSource || (g.firstName ? 'booking' : 'unknown');
    const nameConfidence = !g.firstName ? 'none' : (nameSource === 'booking' || nameSource === 'manual') ? 'verified' : 'unverified';
    const requestedPeriods = (g.requestedPeriods || []) as Array<{ start: string; end: string; askedOn: string; outcome: string; note?: string }>;
    const lastRequest = requestedPeriods.length ? requestedPeriods[requestedPeriods.length - 1] : null;

    const groundedFacts: any[] = [];
    if (g.firstName) groundedFacts.push({ key: 'firstName', value: g.firstName, source: `guests/${gid}` });
    if (kind === 'lead') {
      if (lastRequest) groundedFacts.push({ key: 'requestedPeriod', value: `${lastRequest.start} → ${lastRequest.end} (asked ${lastRequest.askedOn}; ${lastRequest.outcome})`, source: `guests/${gid}` });
      if (g.nonConversionReason === 'unavailable') groundedFacts.push({ key: 'weCouldNotHost', value: 'the dates they asked for were already taken — nothing went wrong between us', source: `guests/${gid}` });
      if (g.firstContactAt) groundedFacts.push({ key: 'firstContactAt', value: g.firstContactAt, source: `guests/${gid}` });
    }
    if (g.partnerName) groundedFacts.push({ key: 'partnerName', value: g.partnerName, source: `guests/${gid}` });
    if (last) groundedFacts.push({ key: 'lastStayPhrase', value: lastStayPhrase(last, AS_OF), source: `bookings/${lastBk.id}` });
    if (last) groundedFacts.push({ key: 'lastStaySeason', value: seasonOf(last), source: `bookings/${lastBk.id}` });
    if (lastBk?.numberOfGuests) groundedFacts.push({ key: 'partySize', value: lastBk.numberOfGuests, source: `bookings/${lastBk.id}` });
    const partyPrice = lastBk?.numberOfGuests ? priceByParty.get(Number(lastBk.numberOfGuests)) : undefined;
    if (partyPrice && brief.stay) groundedFacts.push({ key: 'priceForParty', value: { guests: Number(lastBk.numberOfGuests), totalLei: partyPrice, checkIn: brief.stay.checkIn, checkOut: brief.stay.checkOut }, source: 'quoteStay (the site price)' });
    if (lastBk && hadChildren(lastBk) === true) groundedFacts.push({ key: 'hadChildren', value: true, source: `bookings/${lastBk.id}` });
    if (totalBookings >= 2) groundedFacts.push({ key: 'isRepeatGuest', value: totalBookings, source: `guests/${gid}` });
    if (booksDirect) groundedFacts.push({ key: 'booksDirect', value: { directBookings: directCount, otaBookings: otaCount }, source: `bookings(guests/${gid})` });
    if (pastOtaChannel) groundedFacts.push({ key: 'pastOtaChannel', value: pastOtaChannel, source: `bookings/${lastBk.id}` });
    reviewThemes.forEach(t => groundedFacts.push({ key: `reviewPraised:${t}`, value: t, source: `reviews/${(rv[0] || {}).id || gid}` }));
    applicableUpdates.forEach((u: any) => groundedFacts.push({ key: `update:${u.id}`, value: u.text, source: 'campaign.updates' }));
    // Only an ASSERTABLE note is admitted to the whitelist; the rest are context (tone, topic) and
    // are still shown below, but the copywriter may not state them.
    notes.filter(n => n.assertable).forEach(n => {
      if (n.facts?.length) n.facts.forEach(f => groundedFacts.push({ key: `note:${f.key}`, value: f.value, source: `guestNotes/${n.id}` }));
      else groundedFacts.push({ key: `note:${n.id}`, value: n.text, source: `guestNotes/${n.id}` });
    });

    return {
      guestId: gid,
      audienceKind: kind,
      firstName: g.firstName || null,
      nameConfidence,   // 'verified' (from a booking) · 'unverified' (a WhatsApp push-name) · 'none'
      writeLanguage,
      recordLanguage: g.language || null,
      threadLanguageDetected: detected,
      careFlags: careByGuest.get(gid) || [],
      relationship,
      lead: kind === 'lead' ? {
        firstContactAt: g.firstContactAt || null,
        daysSinceFirstContact: g.firstContactAt ? days(new Date(`${g.firstContactAt}T00:00:00Z`), AS_OF) : null,
        nonConversionReason: g.nonConversionReason || null,
        requestedPeriods,
        note: 'This person never stayed. Do NOT imply they did — no "cand ati fost la noi", no season reference, no review. Build on what they asked for and what happened to it.',
      } : null,
      dossier: {
        tier: kind === 'lead' ? 'lead' : totalBookings >= 2 ? 'repeat' : 'single',
        totalBookings,
        lastStay: last ? ymd(last) : null,
        lastStayPhrase: lastStayPhrase(last, AS_OF),
        lastStaySeason: last ? seasonOf(last) : null,
        partySize: lastBk?.numberOfGuests ?? null,
        // null = never recorded. Returning `false` here stated something nobody established, to a
        // writer whose whole contract is that it may only assert what the pack grounds.
        hadChildren: lastBk ? hadChildren(lastBk) : null,
        reviewThemes,
        bookingChannel: { lastChannel, directCount, otaCount, pastOtaChannel },
      },
      applicableUpdates,
      groundedFacts,
      thread,
      threadNote: thread.length ? `${thread.length} prior messages — read to AVOID repeating what was already said, and to match tone. Do NOT assert a new guest-specific fact from the thread that is not in groundedFacts.` : 'no prior WhatsApp history — a first contact; include the opt-out line.',
      notes: notes.map(n => ({
        id: n.id, at: n.occurredAt, kind: n.kind, initiatedBy: n.initiatedBy ?? null,
        text: n.text, assertable: n.assertable,
        factKeys: n.assertable ? (n.facts?.length ? n.facts.map(f => `note:${f.key}`) : [`note:${n.id}`]) : [],
      })),
      notesNote: notes.length
        ? `${notes.length} note(s) about interactions OUTSIDE WhatsApp — the owner's own record, mostly phone calls. This is where the relationship actually is; the thread alone would misread it. Only notes with assertable=true may be STATED (tag their factKeys); the others inform tone and topic only.`
        : 'no off-WhatsApp interactions recorded.',
    };
  });

  return {
    meta: { generatedFor: brief.propertyId, asOf: ymd(AS_OF), generator: 'src/lib/growth/copywriterPack.ts', briefId: brief.opportunity?.id },
    campaign: { occasion: brief.occasion, offer: brief.offer, updates: framingUpdates, intent: brief.intent, generalAngle: brief.generalAngle, masterMessage: brief.masterMessage?.trim() || null, stay: brief.stay ?? null },
    voiceProfile: {
      note: 'Imitate this register — these are the owner\'s REAL past messages, tagged by outcome (booked/replied/silent). Copy the voice, not the content. Prefer what "booked".',
      exemplars: voiceExemplars,
    },
    voiceRules: {
      language: 'Write each message in that guest\'s writeLanguage (thread-detected: "ro" or "en"). Romanian is written WITHOUT diacritics (matches the owner). Do NOT trust recordLanguage — it is a blanket "ro" default. An English-speaking expat living here (RO phone) gets an English message.',
      register: 'Pick ONE register per message and keep it consistent throughout — either tu (informal: tu/iti/te/ai) OR voi/dumneavoastra (formal: voi/va/ati). NEVER mix them in the same message (not even "ati fost… iti dau"). Choose per guest: if there is a prior thread, match how the owner addressed them there; if there is NO prior thread (a first contact), use polite voi (you do not address a stranger with tu); otherwise default to the warm informal tu.',
      length: '300-600 characters, 3-6 short sentences',
      punctuation: 'Never use an em dash or en dash; the owner writes a plain hyphen or a comma. Plain, everyday Romanian, the way he texts - not literary.',
      master: 'If campaign.masterMessage is set, the owner approved its CONTENT: the dates, the prices, the offer, the PS lines. Carry all of that, and add no campaign claim it does not make. Its WORDING is his example, not a template: write THIS guest\'s message as your next message in your conversation with them, in your own words, and use his phrasing only where it fits naturally. Never open with the master\'s opening line for a guest you have actually talked to. PRICE: if the guest has a `priceForParty` fact, quote THAT price for their party size (written with a dot for thousands) and tag priceForParty; only without it (a lead, an unknown party size) keep the example price from the master and offer the exact price for their group. When there is no masterMessage, write from generalAngle as below.',
      variety: 'campaign.generalAngle is a BRIEF for you, not text to copy. Do not lift its phrases into the message; say the idea in your own words, differently for each guest, and pick only the one or two details that fit THIS guest.',
      emoji: 'Emoji are allowed but used with care: most messages need none, a few carry one to underline a warm note (like the owner\'s own ;) ). Never decorative, never several, and never the same emoji across the whole campaign.',
      conversation: 'Start from where the conversation actually left off. Read the last messages from the guest and the owner. If they said they would think about it, would come back in a certain month, would let you know, asked about a dog, kids or anything else, pick it up first and naturally ("ziceai in iunie ca va ganditi la vara - stiu ca vara zboara", "cu cainele nu e nicio problema, se poate aranja"), and cite that message as thread:<ts> in factsUsed. Then bring the news. No pressure: you are reminding, not chasing. If the thread has nothing to pick up, say nothing about it rather than inventing a link.',
      continuity: 'These are ONGOING relationships, not cold sends. READ the guest\'s `thread`, `notes` and `relationship` and continue it naturally — pick up where you left off, and where it fits, nod to the last exchange. NEVER re-say something the thread shows you already told them (see `updates`). Use `relationship.state`, which is computed across BOTH channels (messages AND logged calls): "active" (engaged, spoke ≤120d ago) → continue warmly, do NOT re-introduce yourself; "lapsed" (engaged before, long ago) → a light reconnect ("a trecut ceva vreme"); "silent" (contacted before, never engaged at all) → a fresh, low-pressure note; "first-contact" (no history whatsoever) → introduce yourself. `relationship.lastExchangeVia` says whether the last contact was WhatsApp or a call — if it was a call, continue from the call, not from the last message.',
      audienceKind: 'Check `audienceKind` FIRST — it changes what you have to work with. A "guest" STAYED: you may reference the stay, the season, the party, what their review praised. A "lead" NEVER stayed — they asked about a stay and it did not happen. Never imply otherwise: no "cand ati fost la noi", no season reference, no review, no "va asteptam din nou". What a lead has instead is in `lead`: the period they asked for (`requestedPeriod`) and `nonConversionReason` — read it, because the four cases are not interchangeable. "unavailable" = WE could not host them, nothing negative happened, so a later "acum s-a eliberat / am putea gasi altceva" is genuinely welcome and is your strongest opening. "declined" = they chose not to; do NOT re-present the same terms as if nothing happened — a lighter, no-pressure note only. "unservable" = we structurally cannot serve what they need; do not raise it again unless something changed. "unresolved" = the conversation simply stopped; a light re-open, not a follow-up. If the reason is null, do not guess one.',
      naming: 'Use `nameConfidence`. "verified" — greet by firstName normally. "unverified" — the name came from a WhatsApp push-name, which may be a nickname, a handle or a shop name; use it ONLY if it plainly reads as a real first name, otherwise greet without a name ("Buna ziua!"). "none" — there is no name at all; greet without one and never invent or guess a name from the phone number or the thread.',
      notes: 'A guest\'s `notes` record interactions that never touched WhatsApp — overwhelmingly phone calls. They are the owner\'s OWN RECALL: real, but unverified and possibly stale, unlike booking data. Read them to know where the relationship truly stands (a warm call outweighs an unanswered message) and to continue from the right point. You may only STATE something from a note whose `assertable` is true, and you must tag its listed `factKeys` in factsUsed. A note with assertable=false may shape tone, topic and warmth but must NEVER be asserted as fact — and never quote a note back verbatim as though the guest had written it.',
      selfId: 'Identify yourself ("Bogdan sunt, de la casuta din Comarnic") ONLY when it helps — a first-contact, a "lapsed"/"silent" state, or a long gap. For an "active" recent thread they know who you are; opening with a re-introduction reads as a form letter — just continue. (Self-ID must still appear somewhere for a first/cold contact — the validator checks it there.)',
      partnerGreeting: 'If a `partnerName` grounded fact is present, the WhatsApp number belongs to that partner (who booked under the guest firstName) — greet BOTH warmly, e.g. "Buna Razvan si Loredana!", and tag `partnerName` in factsUsed. If there is no partnerName, greet only by firstName.',
      optOut: 'Give a graceful, low-pressure way out to a FIRST contact AND to a "silent" guest (messaged before, never replied) — e.g. "daca preferi sa nu-ti mai scriu, spune-mi". An "active"/"lapsed" guest who has replied does NOT need one — it would be odd. Use judgment from `relationship.state`. Any LEAD (audienceKind "lead") gets one regardless of state: a past guest has a real relationship with you, whereas someone who enquired once and never stayed has a much thinner basis for being written to again — so always leave the door open in both directions.',
      grounding: 'assert ONLY facts present in that guest\'s groundedFacts; tag each claim in factsUsed with its key. No invented stays/preferences. Knowing WHEN they stayed is not knowing what they LIKED: never write "stiu ca ti-a placut..." unless a reviewPraised:* or note fact says so (tag it). And never tie today\'s price to their past booking ("cum a fost si rezervarea ta") - a past party size can be mentioned, a past price cannot.',
      intent: 'campaign.intent sets the ASK. "gap_fill" = a warm invite that carries the offer (see offerPresentation). "share" = a NO-ASK keep-in-touch or re-introduction: do NOT mention any offer or discount, do NOT ask them to book — write a genuine, short, warm hello that only keeps the door open (e.g. "cand va doriti, stiti unde ne gasiti"). For a "share" to a long-lapsed or first contact, gently remind them who you are and roughly when they stayed, and ALWAYS include an easy opt-out. Pure good mood, zero pressure.',
      offerPresentation: 'ONLY for intent "gap_fill". The offer (campaign.offer) is set by the owner - never inflate or invent one, only phrase it. If the offer has no discount (type "none" or discountPct null), write NO percentage, NO "reducere", NO "discount", NO price cut of any kind - the offer is what campaign.offer.description says (e.g. early access: you are telling them before the dates are promoted anywhere else). Early access is NOT exclusivity: the dates stay bookable by anyone on the site, Booking and Airbnb, so never write that nobody else can see or book them ("pana nu le vede altcineva", "doar pentru tine", "ai prioritate"). And never say or imply they booked direct before unless they have `booksDirect`. Past exemplars that quote a discount are NOT the offer. The booking channel is handled per guest: (a) a guest with `booksDirect` already books with you directly - do NOT talk about booking direct, better prices than Booking/Airbnb or platforms at all; it is not news to them and reads like a sales line. (b) a guest with `pastOtaChannel` has only ever booked through that platform - you MAY add, once and plainly, that they can now book directly with you at a better price than on that platform, naming it (e.g. "acum poti rezerva direct cu mine, la un pret mai bun decat pe Booking"); tag `pastOtaChannel`. Compare with booking on that platform today, never with what they paid back then. (c) a LEAD never booked anywhere - no channel talk.',
      updates: 'Each guest\'s `applicableUpdates` lists campaign news new SINCE THAT guest\'s last stay (date-filtered). BUT before mentioning one, CHECK the thread: if you already told this guest about it in a previous message, do NOT re-announce it as "noutate" — either build on it ("cum ti-am zis, avem acum…") or leave it out; mention only the part that is genuinely new to them. Decide per guest whether it is worth raising at all — do not force it into every message. You may mention ONLY updates in that guest\'s applicableUpdates, tagging factsUsed with the `update:<id>` key.',
      sentiment: 'always positive. For a careFlag complaint: if (and only if) an issueResolved:* fact is present, you MAY add a warm PS acknowledging the fix; otherwise do NOT mention the past problem at all — write a normal forward-looking message.',
    },
    guests,
  };
}
