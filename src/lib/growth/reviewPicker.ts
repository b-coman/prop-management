/**
 * reviewPicker — choose ONE real guest review for a `proof` page post, and say honestly what
 * language it was written in.
 *
 * WHY THIS EXISTS. The first proof post was built by hand: the operator went looking for a review,
 * pasted it into the prompt, and the writer quoted it. That does not survive a fortnight planned in
 * one go, and it quietly biases the page towards whichever review is easiest to remember — which is
 * the same one, every time. This picks from the real 110-review corpus, never repeats a review, and
 * spaces the same guest apart.
 *
 * ROMANIAN FIRST, BUT NOT ROMANIAN ONLY. The page speaks Romanian and a Romanian quote lands
 * hardest, but only 19 of the 85 usable Prahova reviews are in Romanian — four fortnights and the
 * well is dry. The rest are real too, and "a family from abroad wrote this in Dutch" is itself proof
 * a Romanian reader cannot get from a Romanian review. So a non-Romanian review is translated by the
 * writer and the ORIGINAL LANGUAGE is named.
 *
 * WE NAME THE LANGUAGE, NOT THE COUNTRY. The review documents carry no country, and a Hebrew speaker
 * is not necessarily Israeli — inferring one from the other is exactly the kind of guess that
 * produces a confidently wrong public post. The language is a fact about the text in front of us.
 * If a `country` field ever lands on the corpus, it can be added on top of this without changing it.
 *
 * The detector is deliberately HIGH-PRECISION, LOW-RECALL: it returns `confident: false` rather than
 * a best guess, and an unconfident detection simply means the post does not mention a language.
 * Silence is free; a wrong claim on a public page is not.
 */

/** Marker tokens per language. Chosen to be discriminating, not exhaustive — a frequency list would
 *  score "casa" for Romanian, Spanish and Italian at once and decide nothing. */
const MARKERS: Record<string, RegExp[]> = {
  ro: [/\b(foarte|pentru|ne-am|recomand|lini[sș]te|c[aă]su[tț]a|curte|gazda|pl[aă]cere|frumos|deosebit|totul|revenim|vom reveni|cu drag|loca[tț]ia|petrecut|copiii?|zile|amenajat[aă]?|dotat[aă]?|primitoare|mul[tț]umim)\b/gi],
  en: [/\b(the|and|was|were|very|place|house|stay(?:ed)?|everything|would|great|clean|beautiful|kids|host)\b/gi],
  es: [/\b(muy|todo|para|casa|estancia|con|los|las|pero|habr[ií]a|agradable|nos)\b/gi],
  it: [/\b(molto|abbiamo|stato|soggiorno|nella|della|siamo|tutto|casa|senza)\b/gi],
  fr: [/\b(tr[eè]s|nous|avons|maison|s[eé]jour|avec|pour|tout|[eé]tait)\b/gi],
  de: [/\b(und|die|der|sehr|war|wohnung|sauber|haus|wir|alles|sch[oö]n)\b/gi],
  nl: [/\b(een|wat|prachtig|huis|verblijf|zeer|met|voor|alles|geweldig)\b/gi],
  pl: [/\b(bardzo|miejsce|dom|dla|byli[sś]my|[sś]wietne|wszystko|super|rodziny)\b/gi],
};
/** Scripts are decisive on their own — no Latin-alphabet language can produce them. */
const SCRIPTS: Array<[string, RegExp]> = [
  ['he', /[֐-׿]/],
  ['ru', /[Ѐ-ӿ]/],
];
/** Romanian diacritics. Their presence is near-proof; their absence proves nothing (most Airbnb
 *  reviews are typed without them), which is why they add score rather than gate. */
const RO_DIACRITICS = /[ăâîșşțţ]/i;

/** How the writer should name a language in Romanian copy. */
export const LANGUAGE_NAME_RO: Record<string, string> = {
  ro: 'română', en: 'engleză', es: 'spaniolă', it: 'italiană', fr: 'franceză',
  de: 'germană', nl: 'olandeză', pl: 'poloneză', he: 'ebraică', ru: 'rusă',
};

export interface DetectedLanguage {
  lang: string;
  /** False when the winner is not clear enough to state in public copy. */
  confident: boolean;
}

/**
 * Best-effort language of a review. Argmax over marker hits, but the winner must clear a floor AND
 * beat the runner-up decisively — otherwise `confident: false`, and the caller says nothing.
 */
export function detectLanguage(text: string): DetectedLanguage {
  const t = (text ?? '').trim();
  if (t.length < 20) return { lang: 'unknown', confident: false };
  for (const [lang, re] of SCRIPTS) if (re.test(t)) return { lang, confident: true };

  const scores = new Map<string, number>();
  for (const [lang, res] of Object.entries(MARKERS)) {
    let n = 0;
    for (const re of res) n += (t.match(re) ?? []).length;
    scores.set(lang, n);
  }
  if (RO_DIACRITICS.test(t)) scores.set('ro', (scores.get('ro') ?? 0) + 4);

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  if (!top || top[1] < 3) return { lang: 'unknown', confident: false };
  // A decisive margin, not a nose. "casa" alone must never decide between ro/es/it.
  if (second && second[1] > 0 && top[1] < second[1] * 1.8) return { lang: top[0], confident: false };
  return { lang: top[0], confident: true };
}

export interface ReviewRow {
  id: string;
  author: string;
  rating: number;
  text: string;
  source: string;
  /** Epoch seconds of the review date, 0 when unknown. */
  at: number;
}

export interface PickedReview extends ReviewRow {
  lang: string;
  /** Only set when detection was confident — the writer may name it, and only then. */
  langNameRo: string | null;
  /** True when the writer must translate the quote into Romanian. */
  needsTranslation: boolean;
}

/** Below this a review is a rating, not a story — nothing to quote. */
const MIN_TEXT = 60;
const MIN_RATING = 4.5;

/** Reviews worth quoting at all: published, high, and actually containing words. */
export function usableReviews(rows: ReviewRow[]): ReviewRow[] {
  return rows.filter(
    (r) =>
      r.rating >= MIN_RATING &&
      r.text.length >= MIN_TEXT &&
      !/^\(rating only\)/i.test(r.text.trim())
  );
}

/**
 * Pick the next review to quote.
 *
 * Order of preference: never-used before anything else; then Romanian over translated (it lands
 * harder and needs no caveat); then a guest we have not quoted recently; then the most recent stay,
 * because "someone who was here in July" is warmer than "someone who was here in 2020".
 */
export function pickReview(
  rows: ReviewRow[],
  opts: { usedReviewIds?: string[]; recentAuthors?: string[] } = {}
): PickedReview | null {
  const used = new Set(opts.usedReviewIds ?? []);
  const recentAuthors = new Set((opts.recentAuthors ?? []).map((a) => a.trim().toLowerCase()));

  const pool = usableReviews(rows).filter((r) => !used.has(r.id));
  if (!pool.length) return null;

  const scored = pool.map((r) => {
    const d = detectLanguage(r.text);
    const isRo = d.lang === 'ro' && d.confident;
    const authorSeen = recentAuthors.has(r.author.trim().toLowerCase());
    // Recency in years, so a 2020 review is not competitive with a 2025 one on a tie.
    const ageYears = r.at ? (Date.now() / 1000 - r.at) / (365 * 86400) : 8;
    // SUBSTANCE. The brief asks the writer to quote "the part that carries a feeling" — a
    // 120-character review has no such part, only a verdict. Rewarding length up to a ceiling picks
    // the review with something to say without preferring the 1,700-word essay over all of them.
    const substance = Math.min(r.text.length, 500) / 50;
    const score = (isRo ? 100 : 0) - (authorSeen ? 60 : 0) - ageYears * 3 + substance + (r.rating >= 5 ? 5 : 0);
    return { r, d, isRo, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  return {
    ...best.r,
    lang: best.d.lang,
    langNameRo: best.d.confident ? LANGUAGE_NAME_RO[best.d.lang] ?? null : null,
    needsTranslation: !best.isRo,
  };
}
