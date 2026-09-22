---
name: whatsapp-backfill
description: >-
  Collect past-guest WhatsApp conversation history (verbatim) into the
  whatsappThreads vault by driving WhatsApp Web read-only via the claude-in-chrome
  browser tools. Use for the one-time RO-guest backfill and the incremental
  recent-tail top-up before each engagement campaign. Not for sending — read-only.
---

# WhatsApp history backfill

Drives **WhatsApp Web** (the owner's logged-in session) to collect each past guest's
**verbatim** conversation into `whatsappThreads/{guestId}` — the data foundation for the
engagement/intelligence layer (voice, engagement signal, grounding). See
`plans/engagement-system.md` §7.0/§7.1. The pure/tested server half is
`src/lib/whatsapp/parse-thread.ts` + `src/services/whatsappThreadService.ts`; the CLI is
`scripts/whatsapp-thread.ts`. **This skill is the browser-orchestration playbook.**

**READ-ONLY and ban-safe by construction** — it never sends, never bulk-acts, only reads
the owner's own chats. Sending stays manual `wa.me` elsewhere.

## Modes
- **Backfill** (first pass): full history per guest (scroll-load all older + walk-collect).
- **Top-up** (before a campaign): recent tail only — Phase 1 (load-older) can be skipped;
  `save` dedupes against the stored thread and appends only new messages.

## Prerequisites (confirm before starting)
1. **WhatsApp Web is open and logged in** in the user's Chrome (`web.whatsapp.com`, tab title
   shows an unread count, not a QR code).
2. **Exactly ONE WhatsApp Web tab** — a second de-syncs the session into a never-settles state.
3. **Phone unlocked and online** — required for "get older messages from your phone" to pull
   deep history; without it, history is shallow.
4. Browser tools loaded: `tabs_context_mcp, computer, javascript_tool, browser_batch`
   (ToolSearch `select:` them). Get `tabs_context_mcp` once to learn the tab id.
5. Don't drive the machine's mouse/keyboard while the browser is being controlled.

## Work-list (resumable)
```
npx tsx scripts/whatsapp-thread.ts queue --lang ro --missing   # remaining backfill (no thread yet)
npx tsx scripts/whatsapp-thread.ts queue --lang ro             # all, with thread status
```
Each row: `guestId  phone(E.164)  name  status`. Process in **batches of ~10–15 with a
check-in between**. `--missing` skips completed guests, so stop/resume anytime.

## 🔴 BEFORE ANYTHING: PROVE THE PHONE IS AWAKE (added 22 Sep 2026)

**An asleep phone silently produces a fully plausible, badly wrong backfill.** The whole 22 Sep run
executed against a sleeping phone: every rich thread returned exactly 1 message, the pull button did
nothing when clicked, and several threads showed the "older messages" banner. None of it errored, and
the results looked like a real sync horizon. Gab was saved as 1 message when the chat holds 16.

**Positive check before you start — do not take "it's open" for an answer.** Open a chat you KNOW is
long (a repeat guest with 50+ stored messages) and count `[data-pre-plain-text]`:
- **≥5 rendered, or a pull button that grows the count when clicked** → phone reachable, proceed.
- **exactly 1 rendered on a chat with 100+ stored messages** → the phone is NOT reachable. Stop and
  ask the owner to unlock it and open WhatsApp. Re-running later costs minutes; a silently thin
  vault costs a campaign.

Re-verify this the moment results look uniformly thin — "every chat returned exactly 1 message" is
the signature, and it is never a real sync horizon.

## The CHAT LIST cannot be enumerated by automation (22 Sep 2026)

Tempting idea: read the sidebar chat list once, sorted by recency, to find exactly which guests have
new activity — instead of visiting every thread. **It does not work, and here is how far it gets.**

- Rows ARE readable: each `#pane-side [role=gridcell]` has `spans[0]` = title (phone for unsaved
  contacts, saved name otherwise) and `spans[1]` = the timestamp (`17:35`, `Yesterday`, `9/13/2026`).
- Use `textContent`, never `innerText` — `innerText` returns `''` for rows outside the viewport.
- After setting `pane.scrollTop`, allow **~2.5s** before reading, or the virtual list serves the old
  rows and you silently collect the wrong window.
- **The blocker:** the list virtualizes, and programmatic `scrollTop` does NOT make it render new
  rows — the offset moves (7352 of 46881) while the same ~57 cells stay mounted. `computer scroll`
  would drive it with real wheel events, but that action **times out** on WhatsApp Web, as do
  screenshots. So you can read roughly the first screen of chats and no further.

**Practical ceiling:** you can confirm who is recent at the TOP of the list (worth doing — it is
cheap and proves the newest chats are synced), but you cannot enumerate the whole list. To find
stale threads beyond that, either visit each one by deep link, or **ask the owner to scroll his own
list and name the chats with recent activity** — seconds for him, ~25s per thread for you.

## 🔴 THE PULL IS TRANSIENT AND RATE-LIMITED — GRAB IN THE SAME VISIT (22 Sep 2026)

**A successful pull does not persist.** Simona's chat was pulled from 1 to 5 messages, then navigated
away from without grabbing. On returning minutes later it showed **1 message and the banner**, and
the button was gone — WhatsApp would not offer the pull again. The same happened to Laurentiu.

So the order is not negotiable: **open → pull → GRAB → save, all in one visit.** Never pull, wander
off, and come back; you lose the history AND your second chance at it for that chat.

Also: a pull can simply refuse. Robert's chat kept its button across two real clicks with 30s waits
and never grew. Two attempts is the limit — stop, and route that guest to a phone export instead of
hammering the button.

Expect the pull to be SLOW and to cascade on its own: Madalina read 1, then 17 after the second
click, then climbed to 35 by itself over the next ~20s before settling. Poll until the count is
stable across two reads rather than grabbing at the first sign of growth.

## Driving the pull button (it MOVES as history loads)

The button sits at the TOP of the loaded history, so each successful pull pushes it **above the
viewport** (measured at `y = -1727` after one pull). A blind re-click hits nothing. Each round:

```
1. locate:  [...document.querySelectorAll('button')].find(b => /get older messages/i.test(b.textContent||''))
2. reveal:  btn.scrollIntoView({block:'center'});  wait ~1.2s
3. measure: btn.getBoundingClientRect()  → centre
4. click:   computer left_click at that centre   ← a REAL click; JS .click() does nothing here
5. wait ~18s, recount, repeat while the button exists
```
Button **gone** = the pull is finished, and `rendered` is the full retrievable count. Verified with a
real click: Simona 1 → 5, Cristian 1 → 6.

## ⚠️ THE ONE RULE THAT MATTERS: wait for the phone-pull to FINISH before grabbing
WhatsApp Web shows the newest message instantly, then pulls the rest **from the phone
asynchronously — 10–20+ seconds**, progressively. Grabbing too early captures only the 1
visible message and silently truncates the thread. **This corrupted dozens of threads before it
was caught** (e.g. a guest saved as "1 msg" actually had 27). The retrievable history is done
loading **only when the clickable "get older messages from your phone" button is GONE.** Poll for
its absence — do NOT trust a message-count plateau (the count stalls mid-pull, then jumps).

Two different top-of-chat indicators — learn to tell them apart:
| Top-of-chat element (`data-pre-plain-text` regex) | Meaning | Action |
|---|---|---|
| Clickable **"get older messages from your phone"** button | more history, **pullable** now | click it, WAIT, re-poll until the button disappears, THEN grab |
| Static grey banner **"Use WhatsApp on your phone to see older messages from before <date>"** | **USUALLY MEANS THE PHONE IS UNREACHABLE — it is not a permanent wall.** Proven 22 Sep 2026: with the phone asleep, Gab's chat showed this banner and rendered 1 message; with the phone awake the same chat auto-synced to **16**, including the 16:07 message previously declared unretrievable. | **STOP. Wake the phone and re-open the chat.** Only treat the thread as web-partial if the banner persists with the phone demonstrably awake and online. |
| Neither | Web has the complete history | grab; it's genuinely complete |

## Per-guest routine — OPEN THE CHAT BY URL, NOT BY SEARCH (rewritten 2026-09-22)

**Do not drive the sidebar search. It no longer works reliably.** Verified on 22 Sep 2026 against
the live app: the search `<input>` is parked off-screen (rect ~`-120,-35`) until you click the
visible affordance; it filters **once per page load** and then stops, because clearing the field
collapses search again and later keystrokes land nowhere. `find` never returns either — WhatsApp Web
never reaches `document_idle`, so every `find` call fails after 45s. Screenshots also time out
(`Script injection timed out`), so drive and inspect this app with `javascript_tool`.

**🔴 NEVER set the search input's value programmatically.** Using the native value setter
(`Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set`) desyncs React's value
tracker **permanently** for that page load: the box shows your text, the list never re-filters, and
nothing signals the failure. It cost most of an hour before a nonsense query (`zzzzqqqxyz`) returning
all 48 chats proved the filter was dead. Only a reload clears it.

**Use the deep link instead.** It is deterministic and needs no search at all:

```
navigate → https://web.whatsapp.com/send?phone=<E164 WITHOUT the leading +>    e.g. 40748393093
wait ~28s total (the app fully reloads; the URL then drops back to web.whatsapp.com/)
```

Then read the state with `javascript_tool`. Three distinct outcomes, and they are NOT the same:

| what you see | meaning | action |
|---|---|---|
| `#main [role=textbox]` aria-label `Type a message to +40 ...`, and `[data-pre-plain-text]` rows | chat open with history | poll the pull-state, then grab |
| same composer, but **zero** `[data-pre-plain-text]` | they are on WhatsApp, you have never exchanged messages | `mark --status no-chat` |
| `[role=dialog]` reading **"The number +40 … isn't on WhatsApp"** | the number has **no WhatsApp account at all** — unreachable on this channel, permanently | `mark --status no-chat`, and tell the owner; the planner should never route WhatsApp at them |

Verify the switch the same way as before: the composer's aria-label must carry **this** guest's
number, and `first`/`last` must differ from the previous guest.

**2. Poll the pull-state** (`javascript_tool`) — clicks the pull button if present, reports state:
```js
(() => {
  const btn=[...document.querySelectorAll('button,div[role="button"]')].find(b=>/get older messages/i.test(b.textContent||''));
  if(btn) btn.click();                                       // kick the pull each poll
  const banner=/Use WhatsApp on your phone to see older messages/i.test(document.body.innerText);
  const e=document.querySelectorAll('[data-pre-plain-text]');
  return JSON.stringify({rendered:e.length, hasPullBtn:!!btn, hasBanner:banner,
    first:e.length?e[0].getAttribute('data-pre-plain-text'):null,
    last:e.length?e[e.length-1].getAttribute('data-pre-plain-text'):null});
})()
```
- Verify `first`/`last` differ from the previous guest (proves the chat switched — never extract a stale chat).
- **While `hasPullBtn===true`: `computer wait 7`, then re-run this JS. Repeat until `hasPullBtn===false`.**
  A rich thread pulls in waves (1 → 26 → 48…); keep going until the button is gone.
- `hasPullBtn===false` → the pull is complete; `rendered` is now the full retrievable count.

**3. Grab + download** (`javascript_tool`) — once the button is gone. `rendered<50` fits the DOM, so a
direct grab is complete; only if `rendered>=~45` do a scroll-collect (Phase 2 below) to defeat
virtualization:
```js
(() => {
  const clean=t=>(t||'').replace(/(https?:\/\/[^\s?]+)\?[^\s]*/g,'$1').replace(/\s+/g,' ').trim();
  const acc=new Map();
  document.querySelectorAll('[data-pre-plain-text]').forEach(el=>{const k=el.getAttribute('data-pre-plain-text');if(k)acc.set(k+'||'+clean(el.innerText),{ppt:k,text:clean(el.innerText)});});
  const rows=[...acc.values()];
  if(!rows.length) return JSON.stringify({count:0});
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(rows)],{type:'application/json'}));a.download='wa-<guestId>.json';document.body.appendChild(a);a.click();a.remove();
  return JSON.stringify({count:rows.length, first:rows[0].ppt, last:rows[rows.length-1].ppt});
})()
```
Scroll-collect (only for `>=~45`): `let p=<scroll pane>; p.scrollTop=0; await sleep(400); grab();`
then `for(...) { grab(); if(atBottom)break; p.scrollTop+=clientHeight*0.5; await sleep(140); } grab();`
accumulating into the same `acc`. A long thread virtualizes to ~50 in the DOM at once.

**4. Save + clean up** (`Bash`) — idempotent (dedupe-append). **Guard the `rm` behind a confirmed
save** (a browser download can lag disk by a second — an immediate save may `ENOENT`; keep the file
so you can retry instead of losing data):
```
F=~/Downloads/wa-<guestId>.json
OUT=$(npx tsx scripts/whatsapp-thread.ts save --guest <guestId> --phone <phone> --rows "$F" 2>&1)
echo "$OUT" | grep -iE 'saved|error|ENOENT'
echo "$OUT" | grep -q 'Saved ' && rm -f "$F" || echo "!! KEPT FILE — save failed, retry"
```
`save` prints `parsed N → +added, total`. Update the prior-guest `first`/`last` and move on.

**Empty / no retrievable text** (`rendered===0` after the pull finished, or an all-media/system chat):
- **Outbound photo-share** (a "Buna <Name>!… doua poze…" outreach sent WITH photos): the text is a
  photo **caption**, which has NO `data-pre-plain-text` (systematic — accepted as "caption loss").
  Screenshot to confirm, then `mark --status empty`.
- **Disappearing-messages** chat (system notice "…uses a default timer for disappearing messages"):
  content is gone → `mark --status empty`.
- Otherwise media/call-only → `mark --status empty`.

## Guards (why each step exists)
- **ONE tab** — a 2nd WhatsApp Web tab de-syncs the session.
- **Wait for the pull button to be GONE (step 2)** — THE fix for the truncation bug: the phone-pull is
  async and slow; a message-count plateau is not "done", the button's absence is. Poll it.
- **Verify-switch** — `first`/`last` must differ from the prior guest, else you save the *previous* thread.
- **Guarded `rm`** — the browser download can lag disk; keep the file if `save` didn't confirm.
- **🔴 Chrome RENAMES downloads, it never overwrites.** A leftover `wa-<guestId>.json` from an
  earlier attempt means your fresh grab silently lands as `wa-<guestId> (1).json`, and `save` then
  ingests the STALE file. This happened on 22 Sep: a 22-message grab was saved as 1 message.
  **`rm -f ~/Downloads/wa-*.json` before every grab, and compare `save`'s parsed count to the count
  the grab reported** — a mismatch means you saved the wrong file.
- **The message list fills AFTER the page looks ready.** One guest read as 1 message and as 22 nine
  seconds later, with no pull button at any point. Waiting for the pull button to vanish is not
  sufficient when the button never appears: re-poll and compare counts before you grab.
- **Use `Array.from(acc.values())`, never `[].slice.call(...)`** — `acc.values()` is a Map iterator,
  and `[].slice.call` on it silently returns `[]`, so the grab reports `count: 0` on a full thread.
- **Idempotent `save`** — re-running/re-auditing a guest only appends genuinely-new messages (safe).
- **Query strings stripped** in the grab — satisfies the browser's anti-exfil guard + drops tokens.
- **Direction** = the `data-pre-plain-text` sender vs the owner name (`Bogdan Coman`), handled at parse time.

## Re-audit an existing thread (catch prior truncations)
Same routine, but compare the pulled `rendered` count to the stored `messageCount`
(`show --guest <id>`): if `rendered > saved`, an earlier pass truncated it — grab + save (append).
If a stored thread's count is *larger* than the current `rendered`, the sync horizon has just shifted
(Web shows less now); your stored data is the more complete one — leave it. A banner-only thread was
never truncatable (nothing was ever Web-pullable beyond what showed), so `rendered==saved` there is complete.

## Error handling
| Symptom | Action |
|---|---|
| `hasPullBtn` stays true across polls | keep waiting + re-polling; rich threads pull in waves (can take 30–60s) |
| Chat didn't switch (`first`/`last` unchanged from prior) | wait 2s, re-check; if still stale, re-run step 1 |
| No chat / "No chats found" for the number | `mark --status no-chat` + continue |
| `rendered===0` after the pull finished | screenshot; photo-share caption / disappearing-msgs / media-only → `mark --status empty` |
| `rendered` grows *after* you thought it was done (late-load) | you grabbed too early — re-poll until button gone, re-grab, `save` (append) |
| `find` returns a stale ref (old guest's row) | its a11y snapshot lags the search; re-verify the search result text via JS, re-`find` |
| Extractor stuck / tool errors 2–3× | stop, report to the user, don't hammer |
| `javascript_tool` "couldn't determine which page" | re-run `tabs_context_mcp` once, then retry the action |

## Scale & safety
- ~30–90s per guest (scroll-collect dominates). 100 guests ≈ 1.5–2.5h → run in batches.
- Writes real private conversations to the **admin-locked** `whatsappThreads` collection — do not
  echo sensitive content back verbatim; report tallies/spans, not raw messages.
- If the browser extension disconnects, `tabs_context_mcp` to re-establish; never reuse stale tab ids.
