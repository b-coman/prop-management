# Landing-Page Engine — Design

**Status:** design agreed 2026-08-08. Build from this. Anchors the owner's brief: *every campaign
generates its own landing page; editable copy + images; looks nice, tells a story, invites bookings;
flexible for a specific window OR a broad season; proposes real bookable "example stays"; includes the
site nav; fast/reliable; reuse existing components, no duplication.*

## Why
FB ad clicks land on the generic `/ro` homepage and bounce (~74% on mobile). Each campaign needs its
own page that matches the ad, tells the season's story, proposes concrete bookable stays, and drives the
real conversion (a tracked click-to-call + a booking deep-link). Generated from the SAME framing that
shapes the ad, so ad + landing are one coherent thing.

## Route
`src/app/lp/[campaign]/[[...path]]/page.tsx` — a **two-segment** catch-all so `middleware.ts` passes it
through untouched (single-segment would be rewritten to `/properties/{slug}/lp`). It parses its own
language path segment (`path[0]` if a supported lang), exactly like `/booking/check`. `force-dynamic`.
Public (guests view it); the config doc is read server-side via Admin SDK (collection stays restricted).

## Data model — `landingPages/{slug}` (Firestore, Admin-SDK-only writes)
```
{
  slug, propertyId, defaultLanguage,          // 'ro' for FB-RO campaigns
  status: 'draft' | 'published',
  campaignRef?: adCampaignId,                  // link back to the ad (cohesion)
  period: { kind: 'window'|'season', start?, end?, label: ml },  // a dated window OR a broad season
  hero:   { imagePath, headline: ml, subcopy: ml },
  story:  { title: ml, body: ml },             // the emotional invitation
  exampleStays: [                              // P1: manual; P2: from the reasoner; editable
    { start, end, nights, label: ml, occasion?, priceHint? }
  ],
  gallery: [imagePath],                        // add/remove/reorder
  offer?:  { text: ml },
  cta:     { phone, showBooking: boolean },
  createdBy, createdAt, updatedAt
}
```
`ml` = multilingual `{ en, ro }` (use `serverTranslateContent`). Images are `storagePath`s resolved to
URLs from `property.images` (same store the ads use, incl. `ad-*` photos + `aiDescription`).

## Rendering + the coupling traps (must respect — the fragile part)
Mirror `property-page-renderer.tsx:730-740` + the property route's provider wrap (`[[...path]]/page.tsx:637`):
1. **Language** — wrap `<LanguageProvider initialLanguage={lang} initialTranslations={getServerTranslations(lang)}>`
   in the route (root layout's global provider lacks the right server dictionary → RO falls back to EN).
2. **Theme** — in the client renderer: `<ThemeProvider initialThemeId={property.themeId}>` +
   `<div style={themeToInlineStyles(getThemeById(property.themeId))}>` + the `<link precedence="default">`
   font. Without inline vars, SSR colors are wrong.
3. **Currency** — inherited from the root `CurrencyProvider`; call `setDefaultCurrency(property.baseCurrency)`
   like the renderer does. Needed by the header currency switcher + any price.
4. **globals.css** — if the transparent `Header` sits over the hero, keep `#main-content` padding-top +
   first-section `-4rem` and the hero's `has-transparent-header slides-under-header` classes.
5. **isCustomDomain** — replicate the host check; nav/footer/CTA link resolution depends on it.

## Reused components (NO duplication — exact imports)
- **Nav:** `Header` from `@/components/generic-header-multipage` (the multipage one). `menuItems =
  overrides.menuItems || template.header.menuItems`; pass `isCustomDomain`, `baseCurrency`, logo.
- **Footer:** `Footer` from `@/components/footer`.
- **UI:** `@/components/ui/{button(card cta variant),card,badge,separator}`, `@/components/ui/safe-image`.
- **Gallery:** `GallerySection` (`@/components/property/gallery-section`) — lightweight.
- **Social proof:** `TestimonialsSection` (`@/components/homepage/testimonials-section`) fed from
  `getPublishedReviewsForProperty(slug, 10)` (`@/services/reviewService`) + `property.ratings`.
- **CTA band:** `CallToActionSection` (`@/components/homepage/call-to-action`) — light.
- **Booking deep-link:** `/booking/check/{slug}/{lang}?checkIn=&checkOut=&guests=&currency=` (styled
  `<Button variant="cta" asChild><Link>`), which pre-fills availability + pricing.

## The landing template — sections (the story)
1. **Nav** (reused, transparent over hero) → guests can reach the full site.
2. **Hero** — a LIGHT custom hero (single `next/image`/`SafeImage`, `priority`+blur) scent-matched to the
   ad (same photo + headline). NOT the heavy `HeroSection` (which embeds the booking widget). Primary CTA
   = click-to-call; secondary = "Check dates".
3. **Story** — the season's invitation (title + prose).
4. **Example stays** ⭐ — 1-3 `Card`s, each a real bookable window: label · dates · nights · from-price ·
   "Book this →" deep-link. (P1 manual, P2 reasoner-generated.)
5. **Gallery** — `GallerySection` with the config's images.
6. **Social proof** — `TestimonialsSection` (or a compact ratings strip).
7. **CTA band** — prominent tracked **click-to-call** + book.
8. **Footer** (reused).

## Click-to-call (build — no `tel:` exists anywhere today)
A `CallButton` client component: `<a href={`tel:${phone}`}>` styled `cta`, firing on click a dataLayer
`click_to_call` event + Meta `Contact` (`fbq('track','Contact')`). Then **register `click_to_call` as a
GA key event** via the Admin API (Editor access granted) — this closes the real-conversion blind spot
(people check price → call; today untracked).

## Example-stays reasoner (P2)
`buildExampleStays(propertyId, period)` — server-only. Reuse:
- `checkAvailabilityWithFlags` (`@/lib/availability-service`) — free nights per property/month
  (missing doc = available).
- The free-run + **bridge-window** algorithms from `situationPack.ts:535-693` — must be EXTRACTED into a
  focused fn reading only `availability` + `priceCalendars` (min-stay) + `holidays` (occasions), because
  `buildSituationPack` loads all collections + withholds inventory on historical dates.
- Pricing: `getPropertyWithDb`/`getPriceCalendarWithDb` + `calculateBookingPrice`
  (`@/lib/pricing/*`), or POST `/api/check-pricing`.
Then a **selection heuristic**: intersect the campaign period with free runs, snap each to an
occasion/bridge window + a sensible length (respecting per-date min-stay), price each → 1-3 example stays.
A small LLM pass may phrase each stay's `label` in the campaign's voice (optional; deterministic first).

## Generate-from-campaign + editor (P3)
- **Generate:** from the ad campaign's framing (occasion, angle, audience, window, chosen photos) — the
  same inputs the ad copywriter used → a landing config draft (headline/story/gallery/example-stays).
  Cohesion: the landing echoes the ad.
- **Editor** (`/admin/landing` or a tab on the ad detail): edit copy (headline/story/section text),
  add/remove/reorder gallery images, accept/edit the reasoner's example stays, publish.

## Ad seam (P4)
Point the composer's default `landingBaseUrl` at `getBaseUrl(customDomain) + '/lp/{campaign}'` — change
`admin/ads/actions.ts:186` (manual/console) + `adPlannerPack.ts:184` (automated). The UTM stamping in
`adComposer.ts:294-304` already appends `utm_campaign` correctly to a URL with query params — no change.
For the CURRENT live heat ad, point its Meta creative link at the new `/lp` page (re-review, no spend).

## Multi-property + fast/reliable
- Resolve the property from the config's `propertyId` (don't depend on the `x-property-slug` header,
  which middleware sets only on custom-domain + `/properties` branches — a main-host `/lp` wouldn't get it).
- Mobile-first: one above-the-fold image with `priority`+blur, minimal client JS, reuse the light sections.
- Everything data-driven from `landingPages` + `property`/`propertyOverrides` — works for any property.

## Phases (each shippable + tested; the `/lp` page is PUBLIC so it can be loaded + screenshotted to iterate on look)
- **P1** — route + config model + the nice template (reused nav/gallery/testimonials/footer + light hero
  + example-stay cards + tracked click-to-call) rendering from a manual config; register the GA key event;
  point the live heat ad at it.
- **P2** — the example-stays reasoner (real, calendar-valid, priced slots).
- **P3** — generate-from-campaign + the admin editor (copy/images/slots).
- **P4** — wire the ad default.
