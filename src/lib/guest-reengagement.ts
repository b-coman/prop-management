/**
 * Guest re-engagement — shared, pure (no Firestore / no React) logic for building a
 * contact list of past Romanian guests plus a personalized RO message.
 *
 * Imported by BOTH:
 *   - the admin export (src/app/admin/guests) — in-app CSV download
 *   - the standalone script (scripts/export-romanian-guests.ts) — ad-hoc CLI export
 * so the two never drift. Keep this file dependency-free.
 */

/** Default RO message template. Placeholders: {name}, {phrase}, {link}.
 *  No diacritics, to match WhatsApp/SMS style. NOTE: the "casuta din Comarnic" /
 *  campfire copy is prahova-specific — edit it when sending for another property. */
export const DEFAULT_RO_MESSAGE_TEMPLATE =
  `Buna {name},\n` +
  `Stiu ca ati petrecut cateva zile {phrase} la casuta noastra de vacanta din Comarnic. ` +
  `Pentru ca ne plac oaspetii care revin, iti dau aici disponibilitatea noastra pentru lunile iulie si august: {link}. ` +
  `Plus o reducere de 10% fata de pretul afisat pe platformele Airbnb / Booking.\n` +
  `Ca noutati, sa stii ca avem o vatra pentru foc de tabara, si daca faceti o rezervare de min 3 zile, ` +
  `va ofer si lemnele necesare pentru o seara minunata in jurul focului.`;

export interface ReengagementContact {
  firstName: string;
  lastName: string;
  lastCheckIn: string; // 'YYYY-MM-DD'
  phone: string;
}

export const REENGAGEMENT_CSV_HEADER = ['First Name', 'Last Name', 'Last Check-in Date', 'Phone Number', 'Message'];

/** Normalize a phone for dedup + Romanian detection. */
export function normalizeRoPhone(raw: string): { norm: string; isRO: boolean } {
  let p = (raw || '').replace(/[\s\-().]/g, '');
  let isRO = false;
  if (p.startsWith('0040')) { p = '+40' + p.slice(4); }
  else if (p.startsWith('40') && p.length === 11) { p = '+' + p; }
  else if (/^07\d{8}$/.test(p)) { p = '+40' + p.slice(1); } // local mobile 07xxxxxxxx
  if (p.startsWith('+40')) isRO = true;
  return { norm: p, isRO };
}

/** Romanian = explicit RO country, OR (no country recorded AND a Romanian phone). */
export function isRomanian(country: string | undefined | null, phone: string | undefined | null): boolean {
  const c = (country || '').trim();
  if (c === 'RO' || c.toLowerCase() === 'romania') return true;
  if (!c) return normalizeRoPhone(phone || '').isRO;
  return false;
}

/** Title-case a (possibly all-caps / all-lowercase) name, preserving hyphens/spaces. */
export function tidyFirstName(raw: string): string {
  const s = (raw || '').trim();
  if (!s) return s;
  return s
    .split(/(\s+|-)/)
    .map((part) => (/^[\s-]+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
    .join('');
}

type Season = 'iarna' | 'primavara' | 'vara' | 'toamna';

/** Season + season-year for a date. Winter (Dec) belongs to the FOLLOWING year so a
 *  whole winter shares one season-year. ord orders seasons within a year. */
function seasonOf(d: Date): { season: Season; sy: number; ord: number } {
  const m = d.getUTCMonth() + 1;
  const y = d.getUTCFullYear();
  if (m === 12) return { season: 'iarna', sy: y + 1, ord: 0 };
  if (m <= 2)  return { season: 'iarna', sy: y, ord: 0 };
  if (m <= 5)  return { season: 'primavara', sy: y, ord: 1 };
  if (m <= 8)  return { season: 'vara', sy: y, ord: 2 };
  return { season: 'toamna', sy: y, ord: 3 };
}

/**
 * Natural Romanian time reference (no diacritics), computed RELATIVE TO `now`.
 *   current season             -> "<season> aceasta"
 *   earlier this calendar year  -> "<season> aceasta" (winter -> "iarna trecuta")
 *   most recent past occurrence (<= ~1 yr) -> "<season> trecuta"
 *   older                      -> "in <season> lui <year>"
 */
export function seasonPhraseRO(checkIn: Date, now: Date): string {
  const s = seasonOf(checkIn);
  const n = seasonOf(now);
  const delta = (n.sy * 4 + n.ord) - (s.sy * 4 + s.ord); // seasons ago; 0 = current

  if (delta <= 0) return `${s.season} aceasta`;
  if (checkIn.getUTCFullYear() === now.getUTCFullYear()) {
    return s.season === 'iarna' ? 'iarna trecuta' : `${s.season} aceasta`;
  }
  if (delta <= 4) return `${s.season} trecuta`;
  return `in ${s.season} lui ${s.sy}`;
}

export function buildReengagementMessage(
  template: string,
  vars: { name: string; phrase: string; link: string }
): string {
  return template
    .split('{name}').join(vars.name)
    .split('{phrase}').join(vars.phrase)
    .split('{link}').join(vars.link);
}

function csvCell(v: string): string {
  const s = (v ?? '').toString();
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build the full CSV (with a per-guest Message column) from already-filtered contacts. */
export function buildReengagementCsv(
  contacts: ReengagementContact[],
  opts: { template: string; link: string; now?: Date }
): string {
  const now = opts.now ?? new Date();
  const lines = [REENGAGEMENT_CSV_HEADER.join(',')];
  for (const c of contacts) {
    const name = tidyFirstName(c.firstName) || c.firstName;
    const phrase = seasonPhraseRO(new Date(c.lastCheckIn), now);
    const message = buildReengagementMessage(opts.template, { name, phrase, link: opts.link });
    lines.push([c.firstName, c.lastName, c.lastCheckIn, c.phone, message].map(csvCell).join(','));
  }
  return lines.join('\n') + '\n';
}
