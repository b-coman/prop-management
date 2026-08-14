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
  themeId: string;
  baseCurrency?: string;
  advertisedRate?: number;
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
  exampleStays: Array<{ start: string; end: string; nights: number; label: string; occasion?: string | null; priceHint?: number | null; guests?: number | null; bookUrl: string }>;
  gallery: LandingImage[];
  offer: string | null;
  phone: string | null;
  showBooking: boolean;
  checkDatesUrl: string;      // the primary booking deep-link (period window or open)
}
