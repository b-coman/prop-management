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
| Static grey banner **"Use WhatsApp on your phone to see older messages"** | older history exists but is **phone-only** (Web won't push it; scrolling up won't convert it) | grab what's shown; this thread is **web-partial** by necessity, not a bug |
| Neither | Web has the complete history | grab; it's genuinely complete |

## Per-guest routine (size-independent — coordinates rescale and break; use `find` + ref-click)

**1. Search** (`browser_batch`) — the search box is a stable element; `find` it once and reuse the
ref across guests. `cmd+a` then type replaces the prior query:
```
browser_batch: computer left_click ref=<searchBoxRef> · computer key "cmd+a" ·
               computer type "<phone>" · computer wait 2
```
Then check results via `javascript_tool`: if `document.body.innerText` contains
"No chats, contacts or messages found" → **no chat**: `mark --status no-chat` + next guest.
Otherwise `find` the first result row under the "Chats" heading and ref-click it; `wait 3`.
(JS `.click()` on the row does NOT fire WhatsApp's React handler — you must ref-click via the extension.)

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
