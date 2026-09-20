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
  /**
   * LIVE weekend detection, instead of hand-written `exampleStays`.
   *
   * A static stay carries a `priceHint` snapshot that nothing invalidates, which is how the
   * toamna-lunga page came to advertise 1.415 lei for a stay whose check-in had passed. When this
   * is set, the cards are built at render time by asking the booking engine which weekends in the
   * window it will actually sell, and at what price (`lib/landing/openWeekends`).
   *
   * It needs no holiday calendar: a booked weekend refuses itself, and so does one inside a block
   * the owner gave a longer minimum stay. `exampleStays` is ignored when this is present.
   */
  autoWeekends?: {
    from: string;              // YYYY-MM-DD — clamped forward to today, never advertises the past
    to: string;                // YYYY-MM-DD
    nights?: number;           // default 2 (Fri→Sun)
    guests?: number;           // default 3 — must match whatever the page's copy claims
    weekday?: number;          // default 5 (Friday)
    limit?: number;            // default 6
    label?: Ml;                // one label for every card, e.g. "Weekend, 2 nopți"
    note?: Ml;                 // one note under every price
  } | null;
  /**
   * Hide the property's "from N RON / night" line in the hero.
   *
   * `advertisedRate` is a whole-property figure (here: the per-night rate on a WEEK, in autumn, for
   * three). On a page that only sells two-night weekends at nearly double that, it is the first
   * number a reader sees and it undercuts every card below it. True suppresses it for this page
   * only; the property's own pages are untouched.
   */
  hideAdvertisedRate?: boolean;
  /**
   * Overrides the closing section's sub-line.
   *
   * The default is "Call us for the best price, or check the dates online." That is right for a page
   * that only invites a phone call. On a page that publishes real prices with a Book button on each
   * one, it tells the reader those prices are not the best price — and gives anyone about to click a
   * reason to stop.
   */
  closing?: { subtitle?: Ml };
  /** Overrides the stays section's heading. The default ("Stays that fit this window" / "Real dates,
   *  ready to book") says nothing a reader can act on — which window, and as opposed to what? */
  staysHeading?: { title?: Ml; subtitle?: Ml | null };
  gallery?: string[];                          // storagePaths
  /** Shown as a link out to the property's full gallery, for people who want more than the strip. */
  galleryUrl?: string | null;
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
  /** Small print behind the "from" rate - asterisk in the hero and the mobile bar, text in the footer. */
  advertisedRateNote?: { en: string; ro: string };
  /**
   * Whole-property capacity, shown next to the price in the hero.
   *
   * A nightly rate with no denominator reads as expensive: 420 lei is cheap for seven people and
   * dear for two, and the page never said which. Measured 19-22 Aug: only 24% of visitors scrolled
   * far enough to reach any price at all, and none of them were told what it buys.
   */
  maxGuests?: number | null;
  /**
   * The adult cap, rendered as a qualifier on the total rather than half of a pair. This field used
   * to sit beside `maxChildren` and print "5 adulți + 2 copii", which reads as the ONLY valid party
   * and understates a house that also takes 4+3. Capacity is a total with an adult cap; see
   * `@/lib/occupancy`. `maxChildren` was removed because no constant can express it — the ceiling on
   * children moves with the adult count.
   */
  maxAdults?: number | null;
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
  exampleStays: Array<{ start: string; end: string; nights: number; label: string; occasion?: string | null; priceHint?: number | null; guests?: number | null; featured?: boolean; note?: string | null; bookUrl: string;
    /** Lead the card with the DATE instead of the label. Auto-weekend cards share one label by
     *  construction, so the label is the identical part and the date is the differing one; leading
     *  with the label makes five cards look the same and hides the only thing that varies. */
    dateLed?: boolean }>;
  gallery: LandingImage[];
  galleryUrl: string | null;
  hideAdvertisedRate: boolean;
  staysHeading: { title: string | null; subtitle: string | null };
  closingSubtitle: string | null;
  offer: string | null;
  phone: string | null;
  showBooking: boolean;
  checkDatesUrl: string;      // the primary booking deep-link (period window or open)
}
