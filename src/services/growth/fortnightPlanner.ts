/**
 * fortnightPlanner — plan the next two weeks of page posts BEFORE writing a word of them.
 *
 * WHY A PLANNER AND NOT A LOOP. Generating four posts is a for-loop; planning a fortnight is not.
 * A fortnight that respects the 60/25/15 mix can still be four posts about the same garden, land an
 * offer the day before the weekend it sells, quote the same guest twice, and burn a fifth of a
 * 59-photo library on a Tuesday. Each of those is invisible one post at a time and obvious across a
 * batch — which is exactly why the batch is the right unit to reason over.
 *
 * DETERMINISTIC, AND SEPARATE FROM WRITING. No LLM runs here. The plan is arithmetic over live data
 * — availability, prices, the holiday calendar, the review corpus, the photo library, the post
 * history — so it is instant, free, repeatable, and reviewable. The operator sees WHAT will be
 * posted and WHY before anything is generated, and can re-plan as many times as he likes. Writing is
 * a second, separate step; nothing here calls Anthropic, writes Firestore, or touches Meta.
 *
 * THE PLAN IS EPHEMERAL ON PURPOSE. It is cheap to recompute and it reads live inventory, so storing
 * it would only create a second version of the truth that goes stale the moment a booking lands.
 * Re-planning tomorrow gives tomorrow's answer, which is the correct behaviour.
 *
 * WHAT IT ACTUALLY REASONS ABOUT
 *   1. MIX AS A DEBT, NOT A QUOTA. Types are chosen greedily by which is furthest below target
 *      across ALL history plus everything already scheduled — the owner's rule, that the ratio holds
 *      over the long run rather than inside each batch.
 *   2. OFFERS ARE PLACED BY THE STAY, NOT BY THE CADENCE. A weekend offer is scheduled backwards
 *      from its own check-in — Tue or Wed, at least three days ahead — because an offer nobody can
 *      act on is not an offer. A real deadline outranks a cadence convention, and when the two
 *      collide the plan says so instead of silently picking the wrong one.
 *   3. SUBJECT VARIETY, NOT JUST TYPE VARIETY. Two `place` posts that both happen to be about the
 *      garden pass every mix check and still make a boring fortnight. Each slot claims a distinct
 *      subject anchor drawn from the photos that actually exist and are not locked by rotation.
 *   4. THE PHOTO BUDGET IS THE BINDING CONSTRAINT, and it is reported rather than hit. 59 photos at
 *      two posts a week is under two months of runway; the operator should learn that from a plan,
 *      not from a post that repeats itself.
 *
 * THE BRIEFS ARE IN ROMANIAN, and that is not cosmetic. The operator reads and edits every one of
 * them before a word is written, and he writes in Romanian — the two briefs he typed by hand
 * produced the two best posts the page has. An English brief also has to be translated by the model
 * on its way to a Romanian caption, and translation is where borrowed phrasing creeps in: the
 * English brief's "the drive that takes an hour" came back out of the model as "drumul care se face
 * într-o oră", nearly word for word. So the briefs are plain INSTRUCTIONS in Romanian, deliberately
 * unpoetic — the facts and the constraints, never a ready-made image for the model to lift.
 *
 * Server-only (Admin SDK + pricing/availability services). Never throws: a source it cannot read
 * becomes a note on the plan, and the plan is still returned.
 */
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { buildExampleStays } from '@/lib/landing/exampleStays';
import { getHolidays, computeOccasions } from '@/lib/growth/signals';
import { pickReview, type ReviewRow, type PickedReview } from '@/lib/growth/reviewPicker';
import { POST_TYPES, type PagePostType } from './pagePostWriter';
import type { PropertyImage } from '@/types';
import { tagLabelRo } from '@/lib/tag-labels';

const logger = loggers.ads;
const DAY = 86400000;
const TZ = 'Europe/Bucharest';

/** The strategy's ratio. `place` earns reach, `proof` earns replies, `offer` converts. */
const MIX_TARGETS: Record<PagePostType, number> = { place: 0.6, proof: 0.25, offer: 0.15 };
/** Photos of the last N committed posts are off-limits — same window the single-post path uses. */
const ROTATION_POSTS = 6;
/** How far back the ratio is measured. ~10 weeks at two posts a week. */
const MIX_WINDOW = 20;
/** Photos per post, for budgeting. The writer picks 3-5; 4 is what it actually picks. */
const PHOTOS_PER_POST = 4;
/** A subject anchor needs at least this many unlocked photos or the album cannot be built. */
const MIN_PHOTOS_PER_ANCHOR = 3;
/** Two posts should not land on consecutive days... */
const MIN_GAP_DAYS = 2;
/** ...unless an offer's own deadline forces it. A real date outranks a rhythm. */
const MIN_GAP_DAYS_OFFER = 1;
/** The owner's rule: a weekend offer must be seen with time to act on it. */
const OFFER_LEAD_DAYS = 3;
/** Where the camera stood, not what the photo is of — never a subject anchor. */
const FRAMING_TAGS = new Set(['exterior', 'outdoor', 'interior']);

/** Publishing times, in Europe/Bucharest, chosen by the DAY rather than the post type: on a working
 *  day people scroll in the evening, at the weekend they scroll over coffee. CONVENTIONS, NOT
 *  MEASUREMENTS — this page has 17 posts in six years and no usable time-of-day signal. Once the
 *  engagement sync has ~20 posts with reactions attached, this becomes answerable from the page's
 *  own data instead of assumed, and should be. */
const WEEKDAY_HOUR = [19, 30] as const;
const WEEKEND_HOUR = [10, 30] as const;
const hourFor = (dateYmd: string) => {
  const w = weekdayOf(dateYmd);
  return w === 0 || w === 6 ? WEEKEND_HOUR : WEEKDAY_HOUR;
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const parseYmd = (s: string) => new Date(`${s}T00:00:00Z`);
const addDays = (s: string, n: number) => ymd(new Date(+parseYmd(s) + n * DAY));
const daysBetween = (a: string, b: string) => Math.round((+parseYmd(b) - +parseYmd(a)) / DAY);
const weekdayOf = (s: string) => parseYmd(s).getUTCDay(); // 0=Sun … 6=Sat
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A wall-clock time in Europe/Bucharest as a UTC ISO string. Measures the zone's offset FOR THAT
 * DATE rather than assuming one: the fortnight after 25 Oct 2026 is UTC+2 while the one before it is
 * UTC+3, and a hardcoded offset would post an hour out for half the year.
 */
export function bucharestIso(dateYmd: string, hour: number, minute: number): string {
  const guess = new Date(`${dateYmd}T${pad(hour)}:${pad(minute)}:00Z`);
  const inZone = new Date(guess.toLocaleString('en-US', { timeZone: TZ }));
  const inUtc = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(+guess - (+inZone - +inUtc)).toISOString();
}

export type SlotAnchor =
  | {
      kind: 'stay';
      start: string; end: string; nights: number; guests: number;
      priceRon: number | null; label: string;
      /** A holiday the stay sits inside, or one it butts against (school starting the day it ends). */
      occasion: string | null;
      occasionRelation: 'inside' | 'ends-before' | 'starts-after' | null;
      includesWeekend: boolean;
    }
  | { kind: 'review'; review: PickedReview }
  | {
      kind: 'subject'; tag: string; photosAvailable: number;
      /** The other subjects this library could carry right now, best first. The plan is a proposal:
       *  the operator edits the brief before a word is written, and needs to see what else is on the
       *  shelf to do that. */
      alternatives: Array<{ tag: string; photos: number }>;
    };

export interface PlannedSlot {
  /** UTC ISO. The console renders it in ro-RO. */
  publishAt: string;
  postType: PagePostType;
  /** The instruction handed to the writer, carrying every fact it may state. */
  brief: string;
  /** Optional framing passed through to the writer as goal/audience. */
  goal?: string;
  audience?: string;
  anchor: SlotAnchor;
  /** Why this slot is this type, on this day — shown before anything is generated. */
  why: string;
}

export interface Slate {
  propertyId: string;
  from: string;
  to: string;
  slots: PlannedSlot[];
  diagnostics: {
    mixBefore: { counts: Record<string, number>; total: number };
    mixAfter: { counts: Record<string, number>; total: number };
    photoBudget: {
      library: number;
      lockedByRotation: number;
      neededForSlate: number;
      spare: number;
      /** Whole weeks the library can sustain at this cadence before it must repeat. */
      weeksOfRunway: number;
      thin: string[];
    };
    notes: string[];
  };
}

interface CommittedPost {
  status: string;
  postType: PagePostType;
  assetPaths: string[];
  message: string;
  reviewId?: string;
  /** From the engagement sync; absent until a post has been read back from the page. */
  reactions?: number;
  at: number; // epoch ms of publish/scheduled time, else creation
}

/** Diacritic-insensitive, punctuation-free — so a review typed without diacritics still matches the
 *  caption that quoted it with them. */
const norm = (s: string) =>
  s.normalize('NFD').replace(new RegExp('[\u0300-\u036f]', 'g'), '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Reviews already quoted on the page. The stored `reviewId` is authoritative, but the first proof
 * post was assembled by hand and carries none — so a distinctive slice of the review's own words is
 * also looked for in past captions. Without that fallback the planner's first act would be to quote
 * Mădălina a second time.
 */
export function alreadyQuoted(reviews: ReviewRow[], posts: Array<{ message: string; reviewId?: string }>): Set<string> {
  const used = new Set<string>();
  const captions = posts.map((p) => norm(p.message ?? ''));
  for (const p of posts) if (p.reviewId) used.add(p.reviewId);
  for (const r of reviews) {
    const slice = norm(r.text).slice(0, 36);
    if (slice.length >= 24 && captions.some((c) => c.includes(slice))) used.add(r.id);
  }
  return used;
}

/** The type furthest below its target, counting history + everything already scheduled. */
export function nextTypeByDebt(counts: Record<string, number>, total: number): PagePostType {
  let best: PagePostType = 'place';
  let worst = Infinity;
  for (const t of POST_TYPES) {
    const gap = (total ? (counts[t] ?? 0) / total : 0) - MIX_TARGETS[t];
    if (gap < worst) { worst = gap; best = t; }
  }
  return best;
}

/**
 * The day an offer must go out: Tue or Wed, at least OFFER_LEAD_DAYS before check-in, and as close to
 * the stay as that allows so it is still fresh. Null when no such day exists.
 */
export function offerPublishDay(stayStart: string): string | null {
  for (let lead = OFFER_LEAD_DAYS; lead <= 6; lead++) {
    const d = addDays(stayStart, -lead);
    const w = weekdayOf(d);
    if (w === 2 || w === 3) return d; // Tue or Wed
  }
  return null;
}

export async function planFortnight(
  propertyId: string,
  opts: { asOf?: Date; posts?: number; horizonDays?: number } = {}
): Promise<Slate> {
  const asOf = opts.asOf ?? new Date();
  const today = ymd(asOf);
  const wanted = opts.posts ?? 4;              // two a week for two weeks
  const horizon = opts.horizonDays ?? 14;
  const notes: string[] = [];

  const db = await getAdminDb();

  // ---------- what is already committed ----------
  const snap = await db.collection('pagePosts').where('propertyId', '==', propertyId).get();
  const committed: CommittedPost[] = snap.docs
    .map((d) => d.data() as Record<string, unknown>)
    .filter((x) => x.status === 'posted' || x.status === 'scheduled')
    .map((x) => {
      const sched = typeof x.scheduledFor === 'string' ? Date.parse(x.scheduledFor) : 0;
      const pub = (x.publishedAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
      const created = (x.createdAt as { toMillis?: () => number } | undefined)?.toMillis?.() ?? 0;
      return {
        status: String(x.status),
        postType: (x.postType as PagePostType) ?? 'place',
        assetPaths: (x.assetPaths as string[]) ?? [],
        message: String(x.message ?? ''),
        reviewId: x.reviewId as string | undefined,
        reactions: typeof x.reactions === 'number' ? x.reactions : undefined,
        at: sched || pub || created,
      };
    })
    .sort((a, b) => b.at - a.at);

  const mixWindow = committed.slice(0, MIX_WINDOW);
  const countsBefore: Record<string, number> = { place: 0, proof: 0, offer: 0 };
  mixWindow.forEach((p) => { if (p.postType in countsBefore) countsBefore[p.postType] += 1; });

  const rotationPosts = committed.slice(0, ROTATION_POSTS);
  const lockedPaths = new Set(rotationPosts.flatMap((p) => p.assetPaths));
  /**
   * A SUBJECT rests for two posts; a PHOTO rests for six. They are different constraints and
   * conflating them was wrong: the photos in an album are already guaranteed distinct by
   * `lockedPaths`, so a second post about the garden a fortnight later shows an entirely different
   * garden — and recurring themes are what a page is made of. Resting a subject for six posts
   * instead starved the plan down to whatever was left over, which on this library is the bedroom.
   */
  const restingTags = new Set<string>();

  // ---------- the photo library ----------
  const propDoc = await db.collection('properties').doc(propertyId).get();
  const images = ((propDoc.data()?.images ?? []) as PropertyImage[]).filter((i) =>
    i.storagePath?.startsWith(`properties/${propertyId}/`)
  );
  const tagsByPath = new Map(images.map((i) => [i.storagePath!, i.tags ?? []]));
  committed.slice(0, 2).forEach((p) =>
    p.assetPaths.forEach((path) => (tagsByPath.get(path) ?? []).forEach((t) => restingTags.add(t)))
  );

  const freePhotos = images.filter((i) => !lockedPaths.has(i.storagePath!));
  const anchorCounts = new Map<string, number>();
  freePhotos.forEach((i) =>
    (i.tags ?? []).forEach((t) => { if (!FRAMING_TAGS.has(t)) anchorCounts.set(t, (anchorCounts.get(t) ?? 0) + 1); })
  );
  /**
   * WHICH SUBJECT TO POST ABOUT — measured where possible, available where not.
   *
   * There is no honest proxy for "which subject makes a good post". Photo count is feasibility, not
   * quality; `people` is 'none' on almost every photo here; activity counts barely vary. So rather
   * than smuggle in taste, this ranks by the only real evidence there is — average reactions on past
   * posts that used the subject — and falls back to availability until that evidence exists. The
   * engagement sync already stores reactions, so this improves on its own as the page posts.
   *
   * Until then the operator is the tie-breaker: every brief is editable before anything is written,
   * and the alternatives are listed beside it.
   */
  const reactionsByTag = new Map<string, { total: number; n: number }>();
  committed.forEach((p) => {
    if (typeof p.reactions !== 'number') return;
    const tags = new Set(p.assetPaths.flatMap((path) => tagsByPath.get(path) ?? []).filter((t) => !FRAMING_TAGS.has(t)));
    tags.forEach((t) => {
      const cur = reactionsByTag.get(t) ?? { total: 0, n: 0 };
      reactionsByTag.set(t, { total: cur.total + (p.reactions as number), n: cur.n + 1 });
    });
  });
  /** Below this the average is one post's luck, not a signal. */
  const MEASURED_MIN_POSTS = 3;
  const measured = (tag: string) => {
    const m = reactionsByTag.get(tag);
    return m && m.n >= MEASURED_MIN_POSTS ? m.total / m.n : null;
  };
  const anchorRank = [...anchorCounts.entries()]
    .filter(([, n]) => n >= MIN_PHOTOS_PER_ANCHOR)
    .sort((a, b) =>
      (restingTags.has(a[0]) ? 1 : 0) - (restingTags.has(b[0]) ? 1 : 0) ||
      (measured(b[0]) ?? -1) - (measured(a[0]) ?? -1) ||
      b[1] - a[1] ||
      a[0].localeCompare(b[0]) // deterministic: the same library must plan the same way twice
    );

  // ---------- real, bookable, priced stays ----------
  let stays: Awaited<ReturnType<typeof buildExampleStays>> = [];
  try {
    stays = await buildExampleStays(propertyId, { kind: 'season', start: null, end: null }, {
      asOf, maxStays: 8, seasonHorizonDays: horizon + 21,
    });
  } catch (e) {
    notes.push(`could not read availability/pricing — no offer can be planned (${(e as Error).message})`);
  }
  let occasions: Awaited<ReturnType<typeof computeOccasions>> = [];
  try { occasions = computeOccasions(await getHolidays(), asOf, 20); } catch { /* occasions are a bonus */ }

  // ---------- reviews ----------
  let reviewPool: ReviewRow[] = [];
  try {
    const rs = await db.collection('reviews').where('propertyId', '==', propertyId).get();
    reviewPool = rs.docs
      .map((d) => {
        const x = d.data() as Record<string, unknown>;
        return {
          row: {
            id: d.id,
            author: String(x.guestName ?? x.name ?? '').trim(),
            rating: Number(x.rating ?? 0),
            text: String(x.comment ?? x.text ?? '').trim(),
            source: String(x.source ?? ''),
            at: Number((x.date as { _seconds?: number } | undefined)?._seconds ?? 0),
          },
          published: x.isPublished !== false,
        };
      })
      .filter((r) => r.published && r.row.text && r.row.author)
      .map((r) => r.row);
  } catch (e) {
    notes.push(`could not read reviews — proof posts will need a quote pasted by hand (${(e as Error).message})`);
  }
  const quoted = alreadyQuoted(reviewPool, committed);
  const quotedAuthors = reviewPool.filter((r) => quoted.has(r.id)).map((r) => r.author);

  // ---------- the calendar of candidate days ----------
  const lastCommitted = committed[0]?.at ? ymd(new Date(committed[0].at)) : null;
  const earliest = [addDays(today, 1), lastCommitted ? addDays(lastCommitted, MIN_GAP_DAYS) : today]
    .reduce((a, b) => (a > b ? a : b));
  const windowEnd = addDays(earliest, horizon - 1);

  // Tue and Fri are the spine: one slot facing the weekend decision, one facing the weekend itself.
  const rhythmDays: string[] = [];
  for (let d = earliest; d <= windowEnd; d = addDays(d, 1)) {
    const w = weekdayOf(d);
    if (w === 2 || w === 5) rhythmDays.push(d);
  }
  for (let d = earliest; d <= windowEnd && rhythmDays.length < wanted; d = addDays(d, 1)) {
    const w = weekdayOf(d);
    if ((w === 3 || w === 6) && !rhythmDays.includes(d)) rhythmDays.push(d); // Wed/Sat fallbacks
  }
  rhythmDays.sort();

  // ---------- build the slate ----------
  const counts = { ...countsBefore };
  let total = mixWindow.length;
  const slots: PlannedSlot[] = [];
  const takenDays: string[] = lastCommitted ? [lastCommitted] : [];
  const usedAnchorTags = new Set<string>();
  const usedReviewIds = new Set<string>(quoted);
  const usedStayStarts = new Set<string>();

  const gapOk = (day: string, isOffer: boolean) => {
    const min = isOffer ? MIN_GAP_DAYS_OFFER : MIN_GAP_DAYS;
    return takenDays.every((t) => Math.abs(daysBetween(t, day)) >= min);
  };

  // Two passes' worth of attempts: a type that cannot be honoured (no offer window, no unquoted
  // review) hands its turn to the next-best type, and the guard stops that handoff looping.
  let attempts = 0;
  for (let i = 0; i < wanted && attempts < wanted * 3; i++) {
    attempts += 1;
    const type = nextTypeByDebt(counts, total);

    if (type === 'offer') {
      const slot = planOffer({ stays, occasions, today, windowEnd, usedStayStarts, gapOk, notes });
      if (slot) {
        slots.push(slot);
        takenDays.push(slot.publishAt.slice(0, 10));
        usedStayStarts.add((slot.anchor as { start: string }).start);
        counts.offer += 1; total += 1;
        continue;
      }
      // No honest offer to make. Fall through to the next-best type rather than invent one.
      notes.push('the mix wanted an offer but no free, priced window in this fortnight could be published Tue/Wed with three days’ notice — planned the next-best type instead');
      counts.offer += 1; total += 1; // treat the debt as paid so the loop does not retry forever
      i -= 1;
      continue;
    }

    const day = rhythmDays.find((d) => !takenDays.includes(d) && gapOk(d, false));
    if (!day) { notes.push('ran out of cadence days inside the fortnight — planned fewer posts'); break; }

    if (type === 'proof') {
      const review = pickReview(reviewPool, {
        usedReviewIds: [...usedReviewIds],
        recentAuthors: quotedAuthors,
      });
      if (!review) {
        notes.push('no unquoted review left in the corpus — planned a `place` post instead of a `proof`');
        counts.proof += 1; total += 1; i -= 1;
        continue;
      }
      usedReviewIds.add(review.id);
      quotedAuthors.push(review.author);
      slots.push(buildProofSlot(day, review));
      takenDays.push(day); counts.proof += 1; total += 1;
      continue;
    }

    const anchor = anchorRank.find(([t]) => !usedAnchorTags.has(t));
    if (!anchor) { notes.push('no unused subject with enough free photos left — stop here rather than repeat a theme'); break; }
    usedAnchorTags.add(anchor[0]);
    const alternatives = anchorRank
      .filter(([t]) => t !== anchor[0] && !usedAnchorTags.has(t))
      .slice(0, 6)
      .map(([tag, photos]) => ({ tag, photos }));
    slots.push(buildPlaceSlot(day, anchor[0], anchor[1], alternatives));
    takenDays.push(day); counts.place += 1; total += 1;
  }

  slots.sort((a, b) => a.publishAt.localeCompare(b.publishAt));

  // ---------- diagnostics ----------
  const perWeek = 2 * PHOTOS_PER_POST;
  const thin: string[] = [];
  const seasonCount = new Map<string, number>();
  images.forEach((i) => {
    const s = (i as { aiDescription?: { season?: string } }).aiDescription?.season ?? 'unknown';
    seasonCount.set(s, (seasonCount.get(s) ?? 0) + 1);
  });
  for (const [season, min] of [['autumn', 16], ['winter', 16]] as const) {
    const n = seasonCount.get(season) ?? 0;
    if (n < min) thin.push(`${season}: ${n} photo${n === 1 ? '' : 's'} (a month of posting needs about ${min})`);
  }
  const rare = [...anchorCounts.entries()].filter(([, n]) => n > 0 && n < MIN_PHOTOS_PER_ANCHOR).map(([t]) => t);
  if (rare.length) thin.push(`too few to build an album around: ${rare.join(', ')}`);
  const resting = [...restingTags].filter((t) => (anchorCounts.get(t) ?? 0) >= MIN_PHOTOS_PER_ANCHOR);
  if (resting.length) {
    notes.push(`resting after the last two posts, so not planned this time: ${resting.join(', ')} — they come back next fortnight`);
  }

  const slate: Slate = {
    propertyId,
    from: slots[0]?.publishAt.slice(0, 10) ?? earliest,
    to: slots[slots.length - 1]?.publishAt.slice(0, 10) ?? windowEnd,
    slots,
    diagnostics: {
      mixBefore: { counts: countsBefore, total: mixWindow.length },
      mixAfter: { counts, total },
      photoBudget: {
        library: images.length,
        lockedByRotation: lockedPaths.size,
        neededForSlate: slots.length * PHOTOS_PER_POST,
        spare: images.length - lockedPaths.size - slots.length * PHOTOS_PER_POST,
        weeksOfRunway: Math.floor((images.length - lockedPaths.size) / perWeek),
        thin,
      },
      notes,
    },
  };
  logger.info('fortnightPlanner: planned', {
    propertyId, slots: slots.length, from: slate.from, to: slate.to,
    types: slots.map((s) => s.postType).join(','), notes: notes.length,
  });
  return slate;
}

// ── slot builders ────────────────────────────────────────────────────────────

function planOffer(ctx: {
  stays: Awaited<ReturnType<typeof buildExampleStays>>;
  occasions: Awaited<ReturnType<typeof computeOccasions>>;
  today: string; windowEnd: string;
  usedStayStarts: Set<string>;
  gapOk: (day: string, isOffer: boolean) => boolean;
  notes: string[];
}): PlannedSlot | null {
  type Cand = { stay: (typeof ctx.stays)[number]; day: string; score: number; weekend: boolean; occ: string | null; rel: 'inside' | 'ends-before' | 'starts-after' | null };
  const cands: Cand[] = [];

  for (const stay of ctx.stays) {
    if (ctx.usedStayStarts.has(stay.start)) continue;
    // An offer with no price is not an offer.
    if (stay.priceHint == null) continue;
    const day = offerPublishDay(stay.start);
    if (!day || day <= ctx.today || day > ctx.windowEnd) continue;
    if (!ctx.gapOk(day, true)) continue;

    let weekend = false;
    for (let k = 0; k < stay.nights; k++) { const w = weekdayOf(addDays(stay.start, k)); if (w === 5 || w === 6) weekend = true; }

    // An occasion the stay sits inside, or one it BUTTS AGAINST — the free weekend whose Monday is
    // the first day of school is the strongest hook this fortnight has, and no single field carries it.
    let occ: string | null = stay.occasion ?? null;
    let rel: Cand['rel'] = occ ? 'inside' : null;
    if (!occ) {
      for (const o of ctx.occasions) {
        if (Math.abs(daysBetween(stay.end, o.startDate)) <= 1) { occ = o.name; rel = 'ends-before'; break; }
        if (Math.abs(daysBetween(o.endDate, stay.start)) <= 1) { occ = o.name; rel = 'starts-after'; break; }
      }
    }
    const score = (weekend ? 60 : 0) + (rel === 'inside' ? 40 : rel ? 25 : 0) - daysBetween(ctx.today, stay.start) * 0.5;
    cands.push({ stay, day, score, weekend, occ, rel });
  }
  if (!cands.length) return null;
  cands.sort((a, b) => b.score - a.score);
  const { stay, day, weekend, occ, rel } = cands[0];
  // Narrowed once, here: `priceHint` is filtered non-null above, `label` is Ml (string | {ro,en}),
  // and `guests` defaults to the base occupancy the pricing call already used.
  const priceRon = stay.priceHint as number;
  const guests = stay.guests ?? 2;
  const labelRo = typeof stay.label === 'string' ? stay.label : stay.label.ro ?? stay.label.en ?? '';

  const [h, m] = hourFor(day);
  const nightsWord = `${stay.nights} nopți`;
  const occLine =
    rel === 'inside' ? `Sejurul cade în "${occ}".`
    : rel === 'ends-before' ? `Sejurul se termină exact când începe "${occ}" - e ultima fereastră liberă dinainte. Ăsta e cârligul.`
    : rel === 'starts-after' ? `Sejurul începe imediat după "${occ}".`
    : '';

  return {
    publishAt: bucharestIso(day, h, m),
    postType: 'offer',
    goal: 'umple o fereastră liberă anume',
    audience: weekend ? 'familii și grupuri de prieteni care își fac planuri pentru weekendul ăsta' : 'cupluri, oameni care lucrează de oriunde, oameni fără copii de școală',
    anchor: {
      kind: 'stay',
      start: stay.start, end: stay.end, nights: stay.nights, guests,
      priceRon, label: labelRo, occasion: occ, occasionRelation: rel, includesWeekend: weekend,
    },
    brief: [
      `Scrie postarea de tip OFERTĂ pentru o fereastră liberă reală de la cabană.`,
      `Apare pe pagină ${roDate(day, h, m)} - scrie-o pentru momentul acela din zi, fără să pomenești ora.`,
      ``,
      `DATELE REALE - spune-le exact, nu inventa nimic:`,
      `  check-in ${stay.start}, check-out ${stay.end} (${nightsWord})`,
      `  total ${priceRon} lei pentru ${guests} persoane, totul inclus`,
      occLine ? `  ${occLine}` : null,
      ``,
      `NU E O LISTĂ DE PREȚURI. Începe cu motivul pentru care cineva ar vrea exact nopțile astea -`,
      `găsește-l singur, nu ți-l dau eu aici. Abia apoi datele și suma, o singură dată, simplu.`,
      `Închide spunându-le cum o pot lua.`,
      `Suma se scrie o singură dată, cu cifre. Niciun alt număr în text.`,
      `Textul de mai sus e instrucțiune, nu material de copiat.`,
    ].filter((l) => l !== null).join('\n'),
    why: `offer · published ${weekdayName(day)} ${day}, ${daysBetween(day, stay.start)} days before check-in · ${weekend ? 'a weekend' : 'a midweek window'}${occ ? ` · ${rel === 'ends-before' ? 'the last free window before' : 'anchored to'} "${occ}"` : ''} · ${priceRon} lei`,
  };
}

function buildProofSlot(day: string, review: PickedReview): PlannedSlot {
  const [h, m] = hourFor(day);
  const foreign = review.needsTranslation;
  return {
    publishAt: bucharestIso(day, h, m),
    postType: 'proof',
    anchor: { kind: 'review', review },
    brief: [
      `Scrie postarea de tip DOVADĂ pornind de la această recenzie reală de ${review.rating} stele,`,
      `lăsată de ${review.author} pe ${review.source}${review.at ? ` în ${roMonthYear(review.at)}` : ''}.`,
      `Apare pe pagină ${roDate(day, h, m)}.`,
      ``,
      `RECENZIA, TEXTUAL:`,
      `"""${review.text}"""`,
      ``,
      review.at
        ? `NU LĂSA IMPRESIA CĂ E RECENTĂ. A fost scrisă în ${roMonthYear(review.at)}; "ne-a lăsat zilele astea" ar fi o mică minciună despre un om real. Ori o citezi fără s-o datezi, ori o datezi corect.`
        : null,
      foreign
        ? `E scrisă în ${review.langNameRo ?? 'altă limbă'}. Citeaz-o TRADUSĂ ÎN ROMÂNĂ` +
          (review.langNameRo
            ? `, și spune limpede că ${review.author} a scris-o în ${review.langNameRo} - un oaspete venit de departe e el însuși o dovadă. Nu spune niciodată din ce țară e: nu știm.`
            : `, dar nu pretinde din ce limbă sau din ce țară vine - nu suntem destul de siguri ca s-o spunem.`)
        : `E deja în română. Citeaz-o cum e; poți repara diacriticele și poți scurta, dar nu-i pune lui ${review.author} cuvinte în gură.`,
      ``,
      `Citează partea care transmite un SENTIMENT, nu partea care înșiră dotări. Apoi una-două fraze`,
      `cu vocea gazdei, despre ce descrie omul acela. Închide cu o întrebare reală, la care se poate`,
      `răspunde. Alege pozele care se potrivesc cu ce spune recenzia.`,
      `Textul de mai sus e instrucțiune, nu material de copiat.`,
    ].filter((l) => l !== null).join('\n'),
    why: `proof · ${review.author} ${review.rating}★ (${review.source}${review.langNameRo ? `, ${review.langNameRo}` : ''})${foreign ? ' · translated' : ''}`,
  };
}

function buildPlaceSlot(day: string, tag: string, photos: number, alternatives: Array<{ tag: string; photos: number }>): PlannedSlot {
  const [h, m] = hourFor(day);
  const when = roDate(day, h, m);
  // The Romanian name for the tag, from the same map the gallery's filter pills use — a brief that
  // says `SUBIECTUL E "terrace"` is half in the language of the database, not of the post.
  const ro = tagLabelRo(tag);
  const subject = ro === tag ? `"${tag}"` : `${ro.toLocaleLowerCase('ro-RO')} ("${tag}")`;
  return {
    publishAt: bucharestIso(day, h, m),
    postType: 'place',
    anchor: { kind: 'subject', tag, photosAvailable: photos, alternatives },
    brief: [
      `Scrie postarea de tip LOC - fără ofertă, fără date, fără preț, fără link.`,
      ``,
      `SUBIECTUL E: ${subject}. Construiește albumul în jurul lui: majoritatea pozelor să-l arate, iar`,
      `textul să fie despre el, nu despre cabană în general. Ai ${photos} poze disponibile cu eticheta "${tag}".`,
      ``,
      `Apare pe pagină ${when}. Scrie-o pentru momentul acela din zi, fără să pomenești ora - un moment`,
      `mic, pe care cineva îl recunoaște, nu o descriere de proprietate. Închide cu o întrebare legată`,
      `de ce se vede efectiv în poze.`,
      `Textul de mai sus e instrucțiune, nu material de copiat.`,
    ].join('\n'),
    why: `place · subject "${tag}" (${photos} free photos) · nothing sold`,
  };
}

/** "noiembrie 2024" — enough to be honest about when a guest stayed, without a full date. */
function roMonthYear(epochSeconds: number): string {
  return new Intl.DateTimeFormat('ro-RO', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(epochSeconds * 1000));
}

function weekdayName(dateYmd: string): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(parseYmd(dateYmd));
}

/**
 * The publish moment as a Romanian reader would say it, so the writer can place the post in time
 * instead of guessing. THE HOUR MATTERS AS MUCH AS THE DAY: given only "marți, 8 septembrie" the
 * first real slate opened a 19:30 post with "Marți dimineața, cafeaua se bea afară" — a caption
 * describing a morning that was eleven hours gone by the time anyone read it.
 */
function roDate(dateYmd: string, hour?: number, minute?: number): string {
  const day = new Intl.DateTimeFormat('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(parseYmd(dateYmd));
  return hour == null ? day : `${day}, la ${pad(hour)}:${pad(minute ?? 0)}`;
}
