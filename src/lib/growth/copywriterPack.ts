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
import type { CampaignBrief } from '@/lib/growth/contracts';
import { normalizeChannel } from '@/lib/channels';
import { hadChildren } from '@/lib/occupancy';

const toD = (v: any): Date | null => v?._seconds ? new Date(v._seconds * 1000) : v?.toDate ? v.toDate() : typeof v === 'string' ? new Date(v) : v instanceof Date ? v : null;
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const days = (a: Date, b: Date) => Math.round((+b - +a) / 86400000);

// Voice-exemplar filters (owner request 2026-07-24): EXCLUDE operational messages (directions,
// check-in access, heating/water troubleshooting) from the voice pool — they are not the warm
// reactivation register we want modeled; and PREFER outreach/reactivation messages within the pool.
const VOICE_LOGISTICS = /waze|goo\.gl\/maps|maps\.app|maps\.google|google maps|plus code|localizare|check[\s-]?in|codul de acces|cheia|drum bun|\bharta\b|calorifer|presiune|termometru|temperatur/i;
const VOICE_OUTREACH = /perioada liber|fereastra liber|s-a eliberat|s-a deschis|\bmi s-a\b|anulare|revii|reveni|prima ocazie|imi aduc aminte|mi-am adus aminte|va doriti|discount|reducere|oferta|weekendul asta liber/i;
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
  tSnap.docs.forEach(d => {
    const t: any = d.data(); const g = guestById.get(d.id);
    const stays = g ? ((g as any).bookingIds || []).map((id: string) => bookingById.get(id)).filter(Boolean) : [];
    (t.messages || []).forEach((m: any, i: number) => {
      const text = m.text || '';
      if (m.direction !== 'out' || text.length < 260) return;
      if (VOICE_LOGISTICS.test(text)) return;   // strip directions / check-in / troubleshooting from the voice pool
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
    if (lastBk && hadChildren(lastBk) === true) groundedFacts.push({ key: 'hadChildren', value: true, source: `bookings/${lastBk.id}` });
    if (totalBookings >= 2) groundedFacts.push({ key: 'isRepeatGuest', value: totalBookings, source: `guests/${gid}` });
    if (booksDirect) groundedFacts.push({ key: 'booksDirect', value: { directBookings: directCount, otaBookings: otaCount }, source: `bookings(guests/${gid})` });
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
        bookingChannel: { lastChannel, directCount, otaCount },
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
      continuity: 'These are ONGOING relationships, not cold sends. READ the guest\'s `thread`, `notes` and `relationship` and continue it naturally — pick up where you left off, and where it fits, nod to the last exchange. NEVER re-say something the thread shows you already told them (see `updates`). Use `relationship.state`, which is computed across BOTH channels (messages AND logged calls): "active" (engaged, spoke ≤120d ago) → continue warmly, do NOT re-introduce yourself; "lapsed" (engaged before, long ago) → a light reconnect ("a trecut ceva vreme"); "silent" (contacted before, never engaged at all) → a fresh, low-pressure note; "first-contact" (no history whatsoever) → introduce yourself. `relationship.lastExchangeVia` says whether the last contact was WhatsApp or a call — if it was a call, continue from the call, not from the last message.',
      audienceKind: 'Check `audienceKind` FIRST — it changes what you have to work with. A "guest" STAYED: you may reference the stay, the season, the party, what their review praised. A "lead" NEVER stayed — they asked about a stay and it did not happen. Never imply otherwise: no "cand ati fost la noi", no season reference, no review, no "va asteptam din nou". What a lead has instead is in `lead`: the period they asked for (`requestedPeriod`) and `nonConversionReason` — read it, because the four cases are not interchangeable. "unavailable" = WE could not host them, nothing negative happened, so a later "acum s-a eliberat / am putea gasi altceva" is genuinely welcome and is your strongest opening. "declined" = they chose not to; do NOT re-present the same terms as if nothing happened — a lighter, no-pressure note only. "unservable" = we structurally cannot serve what they need; do not raise it again unless something changed. "unresolved" = the conversation simply stopped; a light re-open, not a follow-up. If the reason is null, do not guess one.',
      naming: 'Use `nameConfidence`. "verified" — greet by firstName normally. "unverified" — the name came from a WhatsApp push-name, which may be a nickname, a handle or a shop name; use it ONLY if it plainly reads as a real first name, otherwise greet without a name ("Buna ziua!"). "none" — there is no name at all; greet without one and never invent or guess a name from the phone number or the thread.',
      notes: 'A guest\'s `notes` record interactions that never touched WhatsApp — overwhelmingly phone calls. They are the owner\'s OWN RECALL: real, but unverified and possibly stale, unlike booking data. Read them to know where the relationship truly stands (a warm call outweighs an unanswered message) and to continue from the right point. You may only STATE something from a note whose `assertable` is true, and you must tag its listed `factKeys` in factsUsed. A note with assertable=false may shape tone, topic and warmth but must NEVER be asserted as fact — and never quote a note back verbatim as though the guest had written it.',
      selfId: 'Identify yourself ("Bogdan sunt, de la casuta din Comarnic") ONLY when it helps — a first-contact, a "lapsed"/"silent" state, or a long gap. For an "active" recent thread they know who you are; opening with a re-introduction reads as a form letter — just continue. (Self-ID must still appear somewhere for a first/cold contact — the validator checks it there.)',
      partnerGreeting: 'If a `partnerName` grounded fact is present, the WhatsApp number belongs to that partner (who booked under the guest firstName) — greet BOTH warmly, e.g. "Buna Razvan si Loredana!", and tag `partnerName` in factsUsed. If there is no partnerName, greet only by firstName.',
      optOut: 'Give a graceful, low-pressure way out to a FIRST contact AND to a "silent" guest (messaged before, never replied) — e.g. "daca preferi sa nu-ti mai scriu, spune-mi". An "active"/"lapsed" guest who has replied does NOT need one — it would be odd. Use judgment from `relationship.state`. Any LEAD (audienceKind "lead") gets one regardless of state: a past guest has a real relationship with you, whereas someone who enquired once and never stayed has a much thinner basis for being written to again — so always leave the door open in both directions.',
      grounding: 'assert ONLY facts present in that guest\'s groundedFacts; tag each claim in factsUsed with its key. No emoji. No invented stays/preferences.',
      intent: 'campaign.intent sets the ASK. "gap_fill" = a warm invite that carries the offer (see offerPresentation). "share" = a NO-ASK keep-in-touch or re-introduction: do NOT mention any offer or discount, do NOT ask them to book — write a genuine, short, warm hello that only keeps the door open (e.g. "cand va doriti, stiti unde ne gasiti"). For a "share" to a long-lapsed or first contact, gently remind them who you are and roughly when they stayed, and ALWAYS include an easy opt-out. Pure good mood, zero pressure.',
      offerPresentation: 'ONLY for intent "gap_fill". The offer (campaign.offer) is set by the owner — never inflate or invent one, only phrase it. Adapt HOW you present it per guest: a guest with a `booksDirect` fact already knows they get your best price directly, so acknowledge that warmly (e.g. "si asa cum stii deja, iti pot da cea mai buna oferta direct") rather than quoting a discount as if it were news; a guest who has only booked via an OTA gets the explicit offer. For a free-night/value offer, describe the value in words, not a bare percentage. Tag `booksDirect` in factsUsed when you use that angle. A LEAD has no booking channel at all — do not reach for either branch. They came to you directly, which is already the best channel there is, so present the offer plainly and warmly, without implying they ever paid a different price.',
      updates: 'Each guest\'s `applicableUpdates` lists campaign news new SINCE THAT guest\'s last stay (date-filtered). BUT before mentioning one, CHECK the thread: if you already told this guest about it in a previous message, do NOT re-announce it as "noutate" — either build on it ("cum ti-am zis, avem acum…") or leave it out; mention only the part that is genuinely new to them. Decide per guest whether it is worth raising at all — do not force it into every message. You may mention ONLY updates in that guest\'s applicableUpdates, tagging factsUsed with the `update:<id>` key.',
      sentiment: 'always positive. For a careFlag complaint: if (and only if) an issueResolved:* fact is present, you MAY add a warm PS acknowledging the fix; otherwise do NOT mention the past problem at all — write a normal forward-looking message.',
    },
    guests,
  };
}
