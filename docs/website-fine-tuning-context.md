# Website Appearance & UX Fine-Tuning — Session Context

> **Start a NEW session with this doc** to fine-tune the RentalSpot website's appearance/UX (Prahova first, but multi-property). This session's focus is the **ad machine** (see `docs/growth-ad-engine-plan.md`) — the website work is deliberately kept separate. Detailed findings: **`docs/website-audit-prahova.md`**.

## Why this exists
The site is about to receive **paid Facebook/Instagram traffic** (Romanian, mobile). Two audits were run (10 Jul 2026). The critical trust/conversion issues were already fixed (below); what remains is **appearance/UX polish + a couple of technical follow-ups**.

## ✅ Already fixed (do NOT redo)
- **Pricing honesty:** `advertisedRate` 160 → **420 RON** (the true calendar minimum; display is "From 420 lei"). Live in Firestore.
- **PR #147** (merged): reviews now lead highest-rated-first (a 3.5★ construction complaint no longer greets visitors; construction is **confirmed over**), dead "Check Availability" CTAs routed to `/booking/check/<slug>`, 9 missing RO locale strings added, `/details` fake demo €-price table hidden, hero images compressed.
- **PR #148** (merged): dedicated 1200×630 `og:image` (`public/images/properties/<slug>/og-image.jpg`) + property-agnostic `resolveOgImage()` in `src/lib/og-image.ts` (checks `property.ogImage` → convention path → featured fallback, always absolute) + completed OG/Twitter tags + fixed a relative-og:image bug.
- **Image weight:** homepage ~13.3 MB → ~2.9 MB (heavy Storage images re-compressed in place, same URLs; 2 local hero images compressed in-repo).
- **`/area-guide`** ("Ghid Local") hidden from nav (placeholder content) — owner will write real content later; see the `area-guide-todo` memory. Un-hide by re-adding to `visiblePages` + `menuItems`.

## ⚠️ CRITICAL — corrected understanding (a first audit got these WRONG; verified in code — do NOT "fix" them)
- **Currency is NOT broken.** `property-page-renderer.tsx` calls `setDefaultCurrency` → timezone detection: `Europe/Bucharest` → RON, else → EUR (unless the user picked). Real RO visitors see **RON**. The `'USD'` in `CurrencyContext.tsx` is only the split-second initial value. Do NOT change the currency default.
- **Language is NOT "English-only."** `LanguageProvider` detects `navigator.language` client-side → a RO browser switches the UI to Romanian. The only real artifact is the **SSR first paint**.

## 🔧 Open fine-tuning / follow-ups (the new session's candidate work)
1. **SSR UI-chrome flicker:** `t()` strings (buttons, header CTA, footer, table headers) render in **English on first paint**, then flip to RO after hydration, because `LanguageProvider` loads `/locales/ro.json` **client-side only**. Marketing copy + OG already SSR in Romanian (via Firestore bilingual content), so this is polish, not a blocker. A real fix = server-side locale loading; **architectural — scope carefully, don't rush**.
2. **Next image optimizer is OFF in production** (`/_next/image` 404s). Confirmed a **documented Firebase App Hosting platform limitation**, not a config bug. Proper fix = a Firebase Extension + Cloud Functions + a custom Next image loader. Bigger infra task; sources are compressed as an interim.
3. **OG finalization:** after the PR #148 deploy settles, **re-run Facebook's Sharing Debugger** on `https://prahova-chalet.ro/ro` ("Scrape Again") to confirm the new dedicated `og:image` + tags are live; **add `fb:app_id`** (a "should fix" warning). Optionally a purpose-shot og:image rather than a crop.
4. **Visual / interactive review a human must do** (audit couldn't headlessly): the real booking flow end-to-end, gallery lightbox, mobile ergonomics (tap targets, spacing), overall visual polish/consistency, typography, hero framing. See `docs/website-audit-prahova.md` P1/P2 + its "VISUAL/INTERACTIVE" tags.
5. **Content the owner must supply:** real `/area-guide` content (see `area-guide-todo` memory), any `/details` real content.

## Constraints (apply to all website work)
- **Multi-property first** — every change must work for ANY property; never hardcode Prahova in shared code.
- **Do NOT touch** the currency/language **detection** logic, or `src/services/growth/**`, `src/app/admin/ads/**`, `apphosting.yaml` (that's the ad-engine workstream).
- **Live-site changes → branch → PR for the owner to review** before merge (unlike the dark ad engine, these hit real visitors immediately). Firestore data changes: use `.update()` / merge, NEVER `.set()` without merge (wipes the doc) — see the "Property Overrides Deployment" memory.
- `npm run build` must pass. Use the structured logger.

## Key files & references
- Detailed audit: `docs/website-audit-prahova.md`
- Currency: `src/contexts/CurrencyContext.tsx`; Language: `src/lib/language-system/**`, `src/middleware.ts` (sets `x-language` from path); Renderer: `src/components/property/property-page-renderer.tsx`; OG: `src/lib/og-image.ts` + `src/lib/structured-data.ts`; Locales: `public/locales/{en,ro}.json`.
- Live domain: `prahova-chalet.ro` (slug `prahova-mountain-chalet`); RO ads land on `/ro`.
