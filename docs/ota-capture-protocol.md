# The OTA capture protocol

**One canonical description of how to read a price off an OTA page.** `ota-parity` and
`competitive-position` both point here rather than restating it, because a rule kept in two places is
a rule that drifts — and a drifted capture loop fails silently, with plausible numbers.

Everything below was learned by getting it wrong. The commentary is the point; the steps without it
look like fussiness rather than scar tissue.

---

## 0. Preconditions, checked once

- Load the browser tools in ONE `ToolSearch` call:
  `select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__browser_batch,mcp__claude-in-chrome__tabs_close_mcp`
- `tabs_context_mcp` once for a tab id. **Never reuse an id from an earlier session.**
- Confirm the owner's Chrome is **signed in to Booking (Genius) and to Airbnb**.
- Work in ONE tab and close it when done.

**`javascript_tool` is the only thing that works.** `computer` screenshots, `get_page_text` and `find`
all time out on these pages, and on the admin app too. Do not spend three attempts rediscovering that.

---

## 1. Capture the whole field from ONE session

The single rule that makes prices comparable. Ours signed in and theirs signed out is not a
comparison; both read the same way is, even when the properties differ in what they offer.

A Genius discount on our listing and none on a competitor's is a **real difference in the offer**, not
a measurement flaw — it is what a signed-in guest sees. Report who the ranking is for; never "correct"
it by guessing an anonymous price.

---

## 2. Prefer the SEARCH page. Fall back to detail pages.

For Booking, one search returns the whole town: ~25 properties, one load, identical conditions, and
each card echoes the search next to its own price. Use `scripts/comp-search.ts` — it prints the URL
and the collector, then turns the result into capture rows.

**Airbnb has a search page too** — `scripts/comp-search-airbnb.ts`. That line read "no equivalent"
for months and was never tested; the owner sent a search URL on 2026-09-02 and it carries a stay
TOTAL on every card, the room id in each card's link, and the echo (`check_in`, `check_out`,
`adults`, `children`) in that same href. Our own card read 2,369 against a stored detail probe of
2,369, and three comparables matched to the leu.

**The two searches differ in what an ABSENCE means, and that difference is the whole design.** Booking
returns the town in one page, so a curated property that is missing has been excluded and that is a
finding it records. Airbnb paginates 18 at a time over ~15 pages of a much wider radius, so "missing"
and "ranked low" are the same shape — it hands absentees back as a PROBE LIST instead. Absence is
usually real (all three on the first run were: one sleeps 3 against a party of 4, one was already
known unavailable, one had genuinely gone off sale), but usually is not always and one load settles it.

Detail pages remain necessary for: absentees from an Airbnb search, listings outside the searched
radius, and capacity verification.

**Three mechanics that will bite you on the search page:**

| | |
|---|---|
| The list is **VIRTUALISED** | Off-screen cards leave the DOM. One page held 25 cards at the top and **6** after scrolling to the bottom. **Collect before scrolling**, or scroll-and-merge. Never scroll then grab. |
| Prices come in **two forms** | 11 of 25 cards carried `Original price X. Current price Y.`; the other 14 a bare `Price X lei`. A pair-only parser misses more than half. |
| Split on the **name anchor** | Splitting the page text on the trailing `See availability` put names and prices in different chunks and parsed 6 of 25. |

**An absence from the search is a FINDING.** The search omits any property that will not take the
party. It is the authority on that; the detail page is not (§5).

---

## 3. Per detail page: navigate, wait on a PREDICATE, stash, parse once

1. `navigate`.
2. Wait ~8-9s, then poll a readiness predicate — not a fixed timer. **A poll must RE-READ after it
   waits**: `for(...){t=innerText; if(ok) break; await sleep}` leaves `t` holding the last failed read.
3. **Stash the FULL `innerText`** in `sessionStorage` and return only a status line. The page runs
   10-16KB and `javascript_tool` truncates its return at ~1KB.
4. After the LAST navigation, paste the extractor **once** and parse the whole batch from storage.
   `window` is wiped by every navigation; `sessionStorage` survives same-origin.

**Never slice the page.** A 700-char head looks sufficient and is not: rate rows sit far below the
fold. Slicing cost a wrong capacity for a village of villas read as one villa, and a wrong verdict on
a property that hosts a party it was recorded as refusing.

**All bulk egress is blocked** — Blob downloads, clipboard, base64 returns, `location.href`. Parse in
the page; return a verdict.

Keep `browser_batch` to **2-3 pages** (one navigate + one stash each) and keep PARSING out of those
calls. Polling and parsing together times out at three pages.

---

## 4. Never hand-roll a parser

| job | use | why |
|---|---|---|
| price, detail page | `IN_PAGE_EXTRACTOR` / `extract()` in `lib/parity` | tested against live fixtures; the two implementations are held in step by an agreement test |
| price, search page | `IN_PAGE_SEARCH_COLLECTOR` + `parseSearchCard` | same |
| identity / capacity | `IN_PAGE_VERIFIER` / `parseIdentity` in `lib/competitive` | same |

An agent once grepped for an extractor, concluded none existed, and hand-rolled one — hitting two bugs
in ten minutes that the real one had already solved. **Read the module first.**

There are necessarily two implementations of each (the extension blocks bulk egress, so parsing happens
in the page). A drifted pair is worse than either alone: the tested one stays green while the running
one reads your data wrong. **Change one and you must change the other**, and the agreement test will
fail until you do. Note it cannot catch a rule neither implements — when adding a branch, add a fixture
that exercises it in the same commit.

---

## 5. The five traps, each of which produced a stored wrong number

**Non-breaking space.** Booking writes `4,180 lei` with U+00A0. Normalise first. A plain-space regex
returns nothing *silently*, which reads like a layout change rather than a whitespace bug.

**Undiscounted pages have no price PAIR.** They print `Price 4,180 lei`. The fallback that expected the
currency first (`lei 4,180`) never matched Booking's own format, so every undiscounted page read as a
parse failure — hidden for months because this property's own listing nearly always carries a Genius
discount.

**`Sleeps:` and `Recommended for` ECHO THE SEARCH.** The same unit reads "4 adults, 2 children" or
"8 adults" depending only on the URL. **`Max persons` is a LOWER BOUND that also grows with the
search** — the same page read 2 and then 4 for one unit. Capacity comes from the **bed configuration,
counted PER UNIT BLOCK**, raised by any `Max persons` in that block. Never summed across the section:
that turned six tiny houses into one 22-person unit.

**The header can echo correctly while the rate table is stale.** A page echoed the requested 4 nights
while serving a different stay's price. Read nights from `Price for N nights` — the rate table's own
heading — so a stale table carries a stale heading and the mismatch is caught.

**A property can REFUSE the party and still print a price.** `Ooops! This is an adult-only property…`
or `Ooops! Only children 12 years and older can stay here`, beside a full total. Two such prices were
stored as a family's price for a stay that family cannot book. The search page omits these properties
correctly; the detail page does not.

---

## 6. The echo check is a HARD ABORT

Compare what the PAGE states — nights, guests, dates — against what the probe asked. On mismatch:
discard, re-navigate once, and if it mismatches again record the cell as `error` with the reason.
**Never bank a number whose echo did not match.**

On the search page the check is per card and applies to the whole batch: if one card disagrees, the
render is mid-update and the entire page is refused rather than partly banked.

---

## 7. Pacing, and when to stop

- Batches of **10-15 cells with a check-in**, and a randomised **3-8s** dwell between cells.
- **On the first CAPTCHA or bot check: STOP and tell the owner.** Do not work around it.
- After **2-3 consecutive tool failures, stop and report** rather than hammering. Screenshots timing
  out twice is the signal to switch method, not to try a third time.
- Never trigger an `alert`/`confirm`/`prompt` — a modal blocks the extension for the session.
- The extension disconnects occasionally mid-batch. It usually reconnects; **verify what actually
  landed** before continuing, because some navigations will have fired.

---

## 8. Recording

Everything goes through **`scripts/parity-capture.ts`** — the one write path. It stamps a timestamp, a
URL, a session and a provenance, and it validates.

- `--rows file.json` for a batch; `--dry-run` first. A bad row never abandons the good ones.
- A competitor row carries `competitorListingId`; the cell id then cannot collide with ours.
- **`refused` / `unavailable` / `error` are OUTCOMES**, and each needs a reason. A cell skipped
  silently is a cell re-walked forever.
- **Never hand-type a number into an ad-hoc script or a message.**

**Fill provenance from measurement, never from a plausible default.** Setting `programApplied: false`
on rows nobody had checked put fabricated evidence in a field that exists to prevent exactly that.

It happened twice. The second time it was a literal in `comp-search.ts`, on every search row — and
there it is not merely unchecked but **unmeasurable**: a search card shows a struck-through price for
a Genius discount and an ordinary promotion alike, and never says which. `CaptureSession.programApplied`
is therefore OPTIONAL, and **absent means not measured**, never "no discount". `promoActive` still
records that something was discounted, which is what the card actually shows.

---

## 9. Read the data back

A write that reports success tells you nothing. `stored: 23` was identical in the run that destroyed
every stored photo and the run that preserved them.

**After any write, read back the fields you wrote — and the ones you did not.** Both data-loss bugs in
this system were found that way, and the second was found only after the first report checked one
field and stopped.

## 10. Hash what you transcribe

A search page's collected output runs ~15KB and every escape route is closed — a `fetch` to
`127.0.0.1` is blocked like the rest — so it comes back in ~900-char slices and is reassembled by
hand. Never parse that reassembly untested. Compute FNV-1a over the string in the page and over the
local file, and compare first:

```js
let h=2166136261>>>0; for(let i=0;i<s.length;i++){h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0;}
```

The first time this ran, length matched and the hash did not: Booking writes **72 non-breaking spaces**
inside its prices, and the transcription had rendered them as plain spaces. Per-slice hashes localise
the damage; a character-code inventory names it; the index list repairs it. Without the check, a
"clean" file would have gone straight into the write path.

**Accumulate, then read out ONCE.** `sessionStorage` survives same-origin navigation, so a batch of
windows should parse into one keyed object and come out in a single pass at the end — not window by
window. Parsing in the page first (`parserSnippet()`) cuts the payload by two thirds and removes every
non-breaking space before it can be lost, which is what turns this step from the run's bottleneck into
a few slices. `scripts/comp-run.ts --plan` emits exactly this.
