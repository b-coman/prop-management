/**
 * generate-from-campaign — landing-page engine P3 (docs/landing-page-engine-design.md §P3). Server-only.
 *
 * Turns an existing ad campaign into a DRAFT landing config, so the landing echoes the ad (one coherent
 * thing). It reuses the campaign's persisted `proposal` framing — occasion, chosen photos, and the copy
 * the ad copywriter already wrote — plus the deterministic example-stays reasoner (P2). Copy is reused
 * as-is for scent-match (headline/hero = the ad's winning variant, story = its most narrative one); an
 * `emit_landing_copy` LLM pass in the ad's voice (mirroring adCopywriter.ts) is the intended follow-up.
 * Nothing is written or sent here — the admin action persists the returned draft to `landingPages/{slug}`.
 */
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { buildExampleStays } from '@/lib/landing/exampleStays';
import type { LandingConfig, Ml } from '@/lib/landing/contracts';

interface CampaignCopyVariant { primary?: string; headline?: string; cta?: string }
interface CampaignProposal {
  occasion?: { name?: string | null; start?: string; end?: string; nights?: number } | null;
  goal?: string | null;
  audience?: string | null;
  creativeBrief?: string | null;
  photos?: Array<{ storagePath?: string; url?: string }>;
  copy?: CampaignCopyVariant[];
}

const stripDiacritics = (s: string) => s.normalize('NFD').replace(new RegExp('[\u0300-\u036f]', 'g'), '');
const monthsRo = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const shortDateRo = (iso: string) => { const [, m, d] = iso.split('-'); return `${+d} ${monthsRo[+m - 1]}`; };

/** A short, URL-safe slug suggestion from the campaign occasion (owner can override in the picker). */
export function suggestLandingSlug(occasionName?: string | null, start?: string | null, fallback = 'campaign'): string {
  const words = stripDiacritics(occasionName || '')
    .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !['din', 'the', 'and', 'pentru', 'catre', 'este'].includes(w));
  const base = words.slice(0, 3).join('-') || (start ? `camp-${start.slice(2, 7).replace('-', '')}` : fallback);
  return base.slice(0, 40);
}

/** Concise hero-badge label from the occasion: "<theme> · <date range>". Editable afterwards. */
function occasionLabel(occ: CampaignProposal['occasion']): Ml {
  const theme = (occ?.name || '').split(/[—\-(]/)[0].trim().slice(0, 32);
  const range = occ?.start && occ?.end ? `${shortDateRo(occ.start)} – ${shortDateRo(occ.end)}` : '';
  const ro = [theme, range].filter(Boolean).join(' · ');
  return { ro: ro || 'La munte' };
}

/**
 * Build a draft LandingConfig from an ad campaign. Throws if the campaign is missing. Returns the config
 * (not persisted) with `status:'draft'` and `campaignRef` set. `slug` is chosen by the caller.
 */
export async function buildLandingDraftFromCampaign(
  campaignId: string,
  opts: { slug: string; createdBy?: string },
): Promise<LandingConfig> {
  const db = await getAdminDb();
  const snap = await db.collection('adCampaigns').doc(campaignId).get();
  if (!snap.exists) throw new Error(`ad campaign ${campaignId} not found`);
  const c = snap.data()!;
  const propertyId: string = c.propertyId;
  const p: CampaignProposal = c.proposal ?? {};
  const occ = p.occasion ?? {};

  const start = occ.start ?? null;
  const end = occ.end ?? null;
  const kind: 'window' | 'season' = start && end ? 'window' : 'season';

  // Example stays from the deterministic reasoner (P2) — real, calendar-valid, priced.
  const exampleStays = await buildExampleStays(propertyId, { kind, start, end });

  // Photos: the SAME assets the ad used (scent-match). First = hero, rest = gallery (deduped, ≤6).
  const photos = [...new Set((p.photos ?? []).map(x => x.storagePath).filter((s): s is string => !!s))];
  const heroImage = photos[0] ?? '';
  // The hero stays IN the gallery. It used to be filtered out to avoid showing the same picture
  // twice, but the gallery is where people swipe on mobile — arriving there and finding the set
  // incomplete is the worse surprise. Promoted to the top, not removed from the grid.
  const gallery = photos.slice(0, 6);

  // Copy: reuse the ad copywriter's output. Hero = winning variant; story body = the most narrative one.
  const copy = p.copy ?? [];
  const lead = copy[0] ?? {};
  const narrative = copy.slice(1).reduce<CampaignCopyVariant | null>(
    (best, v) => ((v.primary?.length ?? 0) > (best?.primary?.length ?? 0) ? v : best), null) ?? lead;

  return {
    slug: opts.slug,
    propertyId,
    defaultLanguage: 'ro',
    status: 'draft',
    campaignRef: campaignId,
    period: { kind, start, end, label: occasionLabel(occ) },
    hero: {
      imagePath: heroImage,
      headline: { ro: lead.headline || 'Escapadă la munte' },
      subcopy: lead.primary ? { ro: lead.primary } : undefined,
    },
    story: {
      title: { ro: (copy[1]?.headline || lead.headline || '') },
      body: { ro: narrative.primary || '' },
    },
    exampleStays,
    gallery,
    offer: { text: { en: 'Direct booking — no commission', ro: 'Rezervare directă, fără comision' } },
    cta: { showBooking: true },
    createdBy: opts.createdBy,
  };
}
