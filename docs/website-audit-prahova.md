# Prahova Chalet — Deep Content/UX/Visual Audit v2 (2026-07-10)

Audited live: `https://prahova-chalet.ro/` + `/ro` + all nav pages (EN & RO, raw SSR HTML), live Firestore (`priceCalendars`, `properties`, `propertyOverrides`, `websiteTemplates`), and the rendering code. Prior audit's currency/language claims treated as corrected and NOT re-flagged.

---

## FACTS (items 4a / 4b / 4c)

### 4a. Minimum bookable nightly price — **420 RON** (confidence: HIGH)
Scanned all 22 `prahova-mountain-chalet_*` price-calendar docs (2025-05 → 2027-02), **available days only**, from today forward:

| Window | Min nightly (RON, base occ. 3) | Season |
|---|---|---|
| **Absolute future min** | **420** (e.g. 2026-11-02) | `2026-late-fall` (Nov–Dec 2026, min stay 2) |
| Jul–Aug 2026 (ad season) | 630 | Summer |
| Sep–Oct 2026 | 472.50 | Fall |
| Jan–Feb 2027 | 525 | Winter |
| Max (holidays) | up to 2,351 (Dec 2026) | NYE overrides |

Honest ad claim: **"de la 420 lei/noapte"** (valid for Nov–Dec 2026 dates). If ads sell summer stays, the honest in-season floor is **630 lei/noapte**. Prices are per-night at base occupancy 3; 4–6 guests cost 705–855 in summer.
**The live site hero currently says "From 160 lei / night" — that price does not exist anywhere in the calendars** (see P0-1).

### 4b. Does `/ro` server-render Romanian? — **Mostly YES for content, NO for UI chrome**
Verified from fetched `/ro` HTML + code:
- **SSR'd in Romanian**: all Firestore bilingual content (hero subtitle, section headings, descriptions, nav labels, host welcome text, attraction cards, CTA block), `<html lang="ro">`, `<title>` context, `meta description`, **OG tags localized** (`og:description` in RO, `og:locale=ro_RO`, `og:url=/ro`), canonical + hreflang correct. Nav links correctly keep the `/ro` prefix on subpages, and `/ro/details` etc. also SSR Romanian content.
- **SSR'd in English (flips to RO only after JS hydration)**: every string that goes through the `t()` translation system — header "Check Availability", booking widget ("Check-in & Check-out", "Select Dates", "Check Dates", "guests/bedrooms/baths", "From … night", "reviews"), "A Warm Welcome from", "Discover what's nearby", footer ("Quick Links", "Contact Us", "All rights reserved"), pricing/distance table headers. Cause: `LanguageProvider` is `"use client"` and fetches `/locales/ro.json` client-side (`src/lib/language-system/LanguageProvider.tsx:139-160, 265-334`); at SSR `translations={}` so `t(key, fallback)` returns the **English fallback**. `public/locales/ro.json` itself is complete (491/491 keys).
- **Permanently English even after hydration** (keys referenced in code but missing from BOTH locale JSONs): see P1-3.

**Verdict: pointing the ad at `/ro` is correct and worthwhile** — link preview (OG), SEO tags, and all body/marketing copy are Romanian from first byte. What remains English at first paint is the UI chrome (buttons/labels), which switches to RO ~1s later, plus ~9 permanently-untranslated strings.

### 4c. Image weight — **~13.3 MB of images on the homepage; Next.js image optimizer is OFF in production**
All 15 `<img>` tags use `next/image` markup (`data-nimg`) but ship **raw original files, no srcset**; `/_next/image` returns **404 on both the custom domain and the hosted.app domain**, while the local build manifest says `unoptimized: false` — i.e. the deployed App Hosting build disables the optimizer (adapter suspect). Offenders (live `content-length`):

| File | Size | Where |
|---|---|---|
| `/images/properties/prahova-mountain-chalet/comarnic-hero-1.jpg` | **1,684 KB** | Hero LCP — also `<link rel="preload">`'d raw |
| firebasestorage `ea48744c-…jpg` | 1,619 KB | homepage gallery strip |
| firebasestorage `17d8d6b9-…jpg` | 1,485 KB | homepage |
| firebasestorage `70ae67f4-…jpg` | 1,472 KB | homepage + **og:image** (FB preview fetches 1.5 MB) |
| firebasestorage `d1812ee7-…jpg` | 1,297 KB | homepage |
| `/images/.../castelul-bran.jpg` | 1,096 KB | attractions card (renders ~200px tall) |
| firebasestorage `8cbcaffe`, `fb9b1471`, `867eb77d`, `cf36070f`, `f8a9a184` | 730–1,078 KB each | features/gallery |

Total homepage images ≈ 13.3 MB (most lazy-loaded, but the 1.68 MB hero is preloaded and is the LCP). On 4G mobile paid traffic this is a conversion killer.

---

## P0 — Broken / blocking for paid traffic

### P0-1. Three mutually contradictory price claims; the advertised one is fantasy
**[CONTENT/DATA decision — operator]** (+ small CODE follow-up)
- **What**: (a) Hero + header badge say **"From 160 lei / night"** (rendered 3× per page) — source: `properties/prahova-mountain-chalet.advertisedRate = 160` (Firestore), with `homepage.hero.price = 150` also stale in `propertyOverrides`. (b) `/details` "Pricing" section shows a **static seasonal table in EUR**: "€120 / €150 / €180 per night, all prices include cleaning fee and taxes, min stay 2–3 nights". (c) The real booking engine charges **420–855+ RON** (≈ €84–172) with different seasons and min-stays.
- **Where**: `https://prahova-chalet.ro/` hero; `https://prahova-chalet.ro/details` pricing block; Firestore `properties/prahova-mountain-chalet` (`advertisedRate`), `propertyOverrides/prahova-mountain-chalet` → `details.visibleBlocks` includes `pricing-detail` with **no property content**, so it renders **template demo data** from `websiteTemplates/holiday-house → defaults.pricingTable`.
- **Why it matters**: A paid visitor who sees "from 160 lei", then "€120–180/night", then a 630 lei/night quote in the booking flow will assume bait-and-switch. This is the single biggest conversion/trust hazard, and "from 160 lei" in proximity to ads is legally risky (misleading price advertising).
- **Fix**: set `advertisedRate` to **420** (or 630 if summer-focused); update `homepage.hero.price`; either populate `details.pricing-detail` with the real RON season table (Late-fall 420 / Fall 472 / Winter 525 / Summer 630, min-stay from calendars) or remove `pricing-detail` from `details.visibleBlocks`. CODE follow-up: consider deriving the "From" price from the live calendars so it can't go stale again.

### P0-2. "Ghid Local" (main nav) opens a page with literal placeholder text
**[CONTENT/DATA decision — operator]**
- **What**: `/area-guide` (nav item "Area Guide" / "Ghid Local") renders **"Page Title" / "Page description goes here"** (EN) and **"Titlul paginii" / "Descrierea paginii"** (RO) as the page header, followed by generic template filler ("Nearest restaurant 500m", "Cuisine: Românească, Italiană", "Trails nearby 5+") that was never customized.
- **Where**: `https://prahova-chalet.ro/ro/area-guide`; cause: `propertyOverrides/prahova-mountain-chalet.visiblePages` includes `area-guide` but the doc has **no `area-guide` key**, so `websiteTemplates/holiday-house → defaults.pageHeader/areaGuideContent` demo content renders.
- **Why**: One click from the paid landing page, the site literally says "Page title". Instantly reads as unfinished/amateur.
- **Fix**: fastest: remove `area-guide` from `visiblePages` and drop the nav item (`menuItems`) — the `/location` page already covers attractions well. Better: write a real area-guide block (the location content proves the operator can).

### P0-3. 13 MB homepage / 1.7 MB preloaded hero — image pipeline effectively unoptimized in production
**[CODE fix]**
- **What/Where**: see FACTS 4c. `src/components/homepage/hero-section.tsx:137-148` uses `next/image` correctly, but production serves originals; `/_next/image` 404s on both domains while the local build has `unoptimized:false` — the App Hosting build (adapter) is disabling the optimizer.
- **Why**: Paid mobile FB/IG traffic on 4G gets a multi-second LCP (1.68 MB hero, preloaded raw) and ~13 MB total. This directly burns ad spend (bounce before first paint of the offer).
- **Fix**: (1) diagnose the App Hosting adapter config so `/_next/image` works (check `@apphosting/adapter-nextjs` version/behavior), OR (2) pre-generate sized variants: hero at ≤1600px/~250 KB WebP; gallery/feature images ≤1200px; attraction thumbs ≤600px. Also re-export `og:image` as a 1200×630 ≤300 KB JPEG (currently 1.47 MB).

---

## P1 — Content/UX/RO issues that hurt conversion

### P1-1. The FIRST testimonial on the homepage is a complaint
**[CODE fix]** + **[CONTENT/DATA decision — operator]**
- **What**: "What Guests Say" shows reviews newest-first; the newest (Illa, Booking.com, Jan 2026) is mostly negative — "construction just a few meters from the house… removed all privacy… that was not possible for us". It leads the section on the homepage AND tops `/reviews` default sort.
- **Where**: `src/components/property/property-page-renderer.tsx:601-613` (real reviews newest-first, no curation) + `src/services/reviewService.ts:31` (`orderBy('date','desc')`).
- **Why**: Paid visitors scanning social proof read the worst review first. Also raises the honest operator question: **is the neighboring construction still active in summer 2026?** If yes, expect this complaint pattern in ad comments too.
- **Fix**: add a `featured`/pinned mechanism or sort by rating-then-recency for the homepage carousel (keep newest-first on /reviews for honesty); or unpublish/deprioritize this one review in admin. Operator: decide how to disclose the construction situation.

### P1-2. English UI chrome at first paint on `/ro` (SSR)
**[CODE fix]**
- **What/Where**: see FACTS 4b. Every `t()` string SSRs as English (header CTA, entire booking widget labels, footer, table headers) because translations load client-side (`src/lib/language-system/LanguageProvider.tsx`). The most visible: the **booking widget** — the primary conversion element — is 100% English at first paint on the RO landing page.
- **Fix**: import `public/locales/{lang}.json` server-side (it's a local file) and pass it into `LanguageProvider` as initial translations from `src/app/properties/[slug]/[[...path]]/page.tsx:495` — eliminates the flash entirely.

### P1-3. 9 strings are English FOREVER on the RO site (missing locale keys)
**[CODE fix]** — keys referenced with `t(key, 'English fallback')` but absent from BOTH `public/locales/en.json` and `ro.json`, so hydration never fixes them:
- `location.openInMaps` ("Open in Google Maps"), `location.seeAllAttractions` ("See all attractions"), `location.mapAlt` — `src/components/homepage/location-highlights.tsx:111,117` (+seeAllAttractions below)
- `gallery.morePhotos` ("more photos"), `gallery.viewAll` ("View All Photos"), `gallery.title`, `gallery.imageOf`, `gallery.imageUnavailable`, `common.property` — `src/components/property/gallery-section.tsx:41-104`
- Visible on the RO homepage right now: "Open in Google Maps", "See all attractions", "+21 more photos", "View All Photos". Fix: add the 9 keys to both JSON files (RO: "Deschide în Google Maps", "Vezi toate atracțiile", "alte fotografii", "Vezi toate fotografiile", …).

### P1-4. Distances table is English-only data on the RO location page
**[CONTENT/DATA decision — operator]**
- **What**: `/ro/location` "Distanțe de la Cabană" rows: "Bucharest Airport", "Bran Castle", "1.5-2h by car", "30 min by car" — plain strings, not `{en,ro}`, in `propertyOverrides → location.distances.distances[]`.
- **Fix**: convert to bilingual ("Aeroportul Otopeni (OTP)", "1,5–2 h cu mașina") — the sibling `attractions` block is already properly bilingual.

### P1-5. Bottom "Check Availability" CTA on every page links to the homepage
**[CONTENT/DATA decision — operator]** (data fix in admin)
- **What**: The big closing CTA banner ("Ready for Your Mountain Getaway? → Check Availability") has `buttonUrl: "/"` in the `cta` blocks of homepage/details/location/gallery (`propertyOverrides`). On the homepage it's a self-link; on subpages it dumps the user back at the top of the home page instead of into booking.
- **Why**: The strongest visual CTA on the site is a dead end; the only real booking entry is the hero date widget.
- **Fix**: point `buttonUrl` to `/booking/check/prahova-mountain-chalet` (works without dates — page asks for them) or at minimum `/#hero`. Note the header "Check Availability" button behaves well (scrolls to widget on homepage, navigates home from subpages — `generic-header-multipage.tsx:120-137`).

### P1-6. `/booking` URL is the House Rules page; rules read as a wall of "No"
**[CONTENT/DATA decision — operator]**
- **What**: Nav "Regulile Casei" → `/booking`, which renders "House Rules & Policies" (the `booking-form` block is `_hidden: true`). Anyone typing/guessing `/booking` — or ad reviewers checking link paths — gets rules, not booking. Also the SSR accordion shows 11 collapsed rule titles, of which four consecutive are "Fumatul Interzis / Fără Oaspeți Neînregistrați / Fără Petreceri / Fără Animale de Companie" — the family-warmth positioning flips to prohibition-list tone. Content itself is well-written and bilingual (cancellation: free ≥7 days, 30% refund <7 days; check-in 14–20h).
- **Fix**: consider renaming the page path (template supports `path`) or unhiding a booking block there; consider leading the rules page with the welcoming policies (check-in, cancellation) before the prohibitions. Low effort, real tone gain.

### P1-7. Review dates render in English format everywhere, including RO
**[CODE fix]** — `src/components/property/property-page-renderer.tsx:592-596` hardcodes `toLocaleDateString('en-US', …)` → "Jan 2026", "Dec 2025" on the RO page. Pass the current language ("ian. 2026" / "dec. 2025").

### P1-8. RO content gaps/nits (RO copy is otherwise excellent — natural, human-written, NOT machine-flavored)
**[CONTENT/DATA decision — operator]**
- `homepage.features.description` has EN ("Discover why you'll want to come back") but **no RO** → the "Ce Face Locul Special" section renders with no subtitle on RO (only genuine bilingual gap in the whole overrides doc — everything else is complete).
- `/details` RO: "Dormitorul Secundar… pentru **2–3 persoane**" but its badge says "**3-4 Persoane**" (EN says "sleeps 3–4"). Pick one.
- "pregătit pentru serile de **cookout**" (homepage features, RO) — anglicism; "pentru serile cu grătar" reads native.
- RO hero subtitle "Comarnic, 100 km de București" is pure logistics vs EN's emotive "Genuine mountain retreat in the Prahova Valley" — intentional? For ads, a benefit-led RO subtitle likely converts better (operator call).
- 5 of 6 homepage testimonials are in English on the RO page (they're real reviews in original language — legitimate, but consider pinning the Romanian ones, e.g. Robert/Airbnb, for RO traffic).

### P1-9. Booking flow first paint ignores the passed dates
**[VISUAL/INTERACTIVE — human must verify]**
- `/booking/check/prahova-mountain-chalet?checkIn=…&checkOut=…` SSRs "Select your dates to see pricing / Choose your check-in and check-out dates…" even when dates are in the URL (client hydration should populate them — verify it actually does, and how long the empty state flashes). Also verify: the RO variant (`…/ro`) SSRs fully in English incl. the language selector showing "EN English" — confirm it flips to RO after hydration, and walk the full flow to Stripe on mobile (pricing display, guest count price changes, hold option, error states). I could not exercise any of this headlessly.

---

## P2 — Polish

1. **Review-count mismatch** on `/reviews`: header "4.9 · 110 reviews" (from `properties.ratings`) next to filter pills "All (96)" with Airbnb 11 / Booking.com 80 / Google 25. Adjacent contradictory numbers look sloppy — recompute or align `ratings.count`. **[CONTENT/DATA]**
2. **og:image is 1.47 MB** — resize to 1200×630 ≤300 KB for fast FB link previews (also pick the best exterior shot deliberately; currently it's whichever image is featured). **[CONTENT/DATA]**
3. **Contact email is `coman2904@gmail.com`** in the footer of a branded property site — a `rezervari@prahova-chalet.ro` alias would look more professional. **[operator]**
4. **`_translationStatus` and full bilingual content payloads** are serialized into every page's RSC stream (~295 KB HTML) — harmless but bloaty; strip admin-only fields server-side. **[CODE]**
5. **Google Fonts (Lora) external request** render-blocks; consider `next/font` self-hosting. **[CODE]**
6. Location RO typo: double space in "mai aventuros,  de la Azuga" (`location.transport` RO text). **[CONTENT/DATA]**
7. `/gallery` loads 27 full-size originals (same optimizer issue as P0-3) — will be heavy until P0-3 lands; verify lightbox/lazy behavior on mobile. **[VISUAL/INTERACTIVE — human]**
8. **Human eyeball list** (cannot judge rendered visuals headlessly): hero photo crop/quality at mobile aspect ratios; consistency of gallery photo color/exposure (mix of interior/exterior shots from different sessions); date-picker ergonomics on small screens; the hero booking widget overlap at `position: bottom` on short viewports; testimonial card text overflow with the very long Illa review; sticky header behavior over the hero. **[VISUAL/INTERACTIVE — human]**

---

## What's genuinely GOOD (don't touch)
- **Romanian copy quality is excellent** — warm, idiomatic, personal ("vedere la veverițe", "Grătar și Tuci", "vatra cu ceaunul"); clearly human-written, better than most RO vacation-rental sites. Firestore bilingual coverage is 100% minus one field.
- Real, sourced reviews (Booking/Airbnb/Google, 4.9/110) with per-source filters; host introduction with name and photo; correct hreflang/canonical; rich JSON-LD (VacationRental, LodgingBusiness, FAQPage, 10 Reviews) — strong SEO/trust foundation.
- Details page room descriptions are specific and honest (bunk-bed weight limit, parking on street) — credibility gold.
- Nav is clean, `/ro` path handling and language routing work correctly end-to-end.

## Verdict
The site's content is **strong** — authentic, specific, bilingual, trust-rich — and comfortably above the quality bar for paid traffic **except** that its money-page facts are broken: the advertised price (160 lei) is fictional, the details-page price table is template demo data in the wrong currency, an entire nav page is literal placeholder text, and the homepage leads its social proof with a complaint. Plus a 13 MB unoptimized image payload that will bleed mobile ad spend. Fix the four P0/P1-1 items (all are data edits + one image-pipeline fix, ~a day of work) and this is a genuinely good paid landing experience; ship ads before fixing them and the ads will actively manufacture distrust.
