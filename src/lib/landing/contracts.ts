/**
 * Landing-page engine — the config a campaign landing page is built from (docs/landing-page-engine-design.md).
 * One doc per campaign in Firestore `landingPages/{slug}`, Admin-SDK-only writes; the /lp route reads it
 * server-side. `Ml` text is multilingual and resolved server-side to a plain string for the target language.
 */
export type Ml = string | { en?: string; ro?: string };

/** A concrete, bookable example stay shown as a card (P1 manual; P2 from the reasoner). */
export interface ExampleStay {
  start: string;          // YYYY-MM-DD checkIn
  end: string;            // YYYY-MM-DD checkout
  nights: number;
  label: Ml;              // e.g. "An extended weekend for the family"
  occasion?: string | null;
  priceHint?: number | null;   // from-price in the property's base currency (P2 fills from pricing)
  guests?: number | null;
  /**
   * Lift one stay out of the equal-width row and render it as the page's recommendation.
   *
   * The grid gave every stay identical visual weight, which is wrong whenever one of them is the
   * offer and the rest are fallbacks: the 22-29 Sep week is the thing worth selling, and a reader
   * scanning three same-sized cards has no way to know that. At most one stay should carry this.
   */
  featured?: boolean | null;
  /**
   * A short line under the price, restating the offer's comparison at the point of decision.
   *
   * Keep it anchored on what the READER is choosing between, not on internal rate-card mechanics.
   * A marginal framing ("the seventh night costs 17 lei") was tried and rejected: it only lands on
   * someone who has already decided to stay six, and nobody arrives at that. They arrive weighing a
   * weekend. So the note repeats the hero's comparison where the button is, rather than introducing
   * a second, narrower argument.
   */
  note?: Ml;
}

export interface LandingConfig {
  slug: string;
  propertyId: string;
  defaultLanguage?: string;                    // 'ro' for RO campaigns
  status?: 'draft' | 'published';
  campaignRef?: string | null;                 // the adCampaigns id (cohesion with the ad)
  period: { kind: 'window' | 'season'; start?: string | null; end?: string | null; label?: Ml };
  hero: { imagePath: string; headline: Ml; subcopy?: Ml };
  story?: { title?: Ml; body?: Ml };
  exampleStays?: ExampleStay[];
  gallery?: string[];                          // storagePaths
  offer?: { text: Ml } | null;
  cta?: { phone?: string | null; showBooking?: boolean };
  createdBy?: string;
}

/** A resolved image, ready for <SafeImage>. */
export interface LandingImage { url: string; displayUrl?: string; blurDataURL?: string; alt: string; storagePath: string }

/** Everything the client renderer needs — all Ml text pre-resolved to the target language. */
export interface LandingModel {
  slug: string;
  language: string;
  isCustomDomain: boolean;
  // property/nav/footer (for the reused Header + Footer)
  propertySlug: string;
  propertyName: string;
  /**
   * The town, for closing copy that names where the guest is actually going ("Te așteptăm la
   * Comarnic" reads far warmer than "la munte"). Read from the property rather than written into the
   * template: the same renderer serves an apartment in Bucharest, where "la munte" would be a lie.
   */
  city?: string | null;
  themeId: string;
  baseCurrency?: string;
  advertisedRate?: number;
  /**
   * Whole-property capacity, shown next to the price in the hero.
   *
   * A nightly rate with no denominator reads as expensive: 420 lei is cheap for seven people and
   * dear for two, and the page never said which. Measured 19-22 Aug: only 24% of visitors scrolled
   * far enough to reach any price at all, and none of them were told what it buys.
   */
  maxGuests?: number | null;
  /** Split of the capacity for display: "5 adulți + 2 copii" is truthful where "7 persoane" is not. */
  maxAdults?: number | null;
  maxChildren?: number | null;
  menuItems: Array<{ label: string; url: string; isButton?: boolean }>;
  logoSrc?: string;
  logoAlt?: string;
  footer: {
    quickLinks?: Array<{ label: string | Record<string, string>; url: string }>;
    contactInfo?: { email?: string; phone?: string };
    socialLinks?: Array<{ platform: string; url: string }>;
  };
  ratings?: { average: number; count: number } | null;
  // the landing content (resolved strings + resolved images)
  hero: { image: LandingImage | null; headline: string; subcopy: string };
  story: { title: string; body: string } | null;
  period: { kind: 'window' | 'season'; start?: string | null; end?: string | null; label: string };
  exampleStays: Array<{ start: string; end: string; nights: number; label: string; occasion?: string | null; priceHint?: number | null; guests?: number | null; featured?: boolean; note?: string | null; bookUrl: string }>;
  gallery: LandingImage[];
  offer: string | null;
  phone: string | null;
  showBooking: boolean;
  checkDatesUrl: string;      // the primary booking deep-link (period window or open)
}
