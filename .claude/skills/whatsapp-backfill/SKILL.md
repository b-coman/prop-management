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

## Per-guest routine
Track the **previous guest's `lastPpt`** (newest message fingerprint) to prove the chat switched.

**1. Search + open (one `browser_batch`)** — coords: search box `(215,85)`, sole result `(297,241)`:
```
browser_batch actions:
  computer left_click (215,85) · computer key "cmd+a" · computer type "<phone>" ·
  computer wait 1.5 · computer left_click (297,241) · computer wait 2
```

**2. Verify the chat switched** (`javascript_tool`) — its `lastPpt` MUST differ from the prior guest:
```js
(() => { const e=document.querySelectorAll('[data-pre-plain-text]'); const l=e.length?e[e.length-1].getAttribute('data-pre-plain-text'):null; return JSON.stringify({rendered:e.length,lastPpt:l}); })()
```
- If `rendered===0` or `lastPpt` equals the prior guest → **not switched**: wait 2s and re-check, or re-run step 1. **Never extract an unswitched chat** (it saves the wrong guest — this has happened).
- If no chat exists for the number (search finds nothing / empty), **skip the guest and log it**.

**3. Scroll-collect the full thread** (`javascript_tool`) — sets `window.__waRows` + a done flag
(the call returns `{}` *before* the async finishes):
```js
window.__waRows=null; window.__waDone=false;
(async () => {
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const clean=t=>(t||'').replace(/(https?:\/\/[^\s?]+)\?[^\s]*/g,'$1').replace(/\s+/g,' ').trim();
  const acc=new Map();
  const grab=()=>document.querySelectorAll('[data-pre-plain-text]').forEach(el=>{const k=el.getAttribute('data-pre-plain-text');if(k){const t=clean(el.innerText);acc.set(k+'||'+t,{ppt:k,text:t});}});
  const pane=()=>{let p=document.querySelector('[data-pre-plain-text]');for(let i=0;i<40&&p;i++){if(p.scrollHeight>p.clientHeight+100&&/(auto|scroll)/.test(getComputedStyle(p).overflowY))return p;p=p.parentElement;}return null;};
  grab();                                                 // collect rendered FIRST — covers short/non-scrollable chats
  let lastN=-1,stable=0;                                  // Phase 1: click "get older" + scroll-top until msg COUNT stabilizes
  for(let i=0;i<40&&stable<5;i++){                        //   ALWAYS click the button (a fully-phone-side chat has 0 rendered);
    const b=[...document.querySelectorAll('button')].find(e=>/get older messages/i.test(e.textContent||'')); //  its pull is slow.
    if(b)b.click();
    const p=pane(); if(p)p.scrollTop=0;
    await sleep(800); grab();
    const n=document.querySelectorAll('[data-pre-plain-text]').length;
    if(n===lastN)stable++; else{stable=0;lastN=n;}
  }
  const p=pane();                                         // Phase 2: walk top->bottom collecting each window (if scrollable)
  if(p){ p.scrollTop=0; await sleep(400); grab();
    for(let g=0,lt=-1,st=0;g<800;g++){grab();if(p.scrollTop>=p.scrollHeight-p.clientHeight-5){grab();break;}p.scrollTop+=Math.floor(p.clientHeight*0.5);await sleep(130);if(p.scrollTop===lt){if(++st>4)break;}else st=0;lt=p.scrollTop;}
    grab(); }
  window.__waRows=[...acc.values()];window.__waDone=true;
})()
```
WhatsApp **virtualizes** long threads (~50 msgs in the DOM at once), so a single `querySelectorAll`
silently truncates them — scroll-and-collect is mandatory. But `grab()` must run FIRST (short chats
have no scroll pane), Phase 1 must ALWAYS click "get older messages" (a fully-phone-side chat renders
0 until pulled, and the pull is slow — track by message COUNT), and Phase 2 only scrolls when a pane
exists. A truly empty/media-only chat legitimately returns 0 → skip + log.

**4. Wait for done** (`javascript_tool`, repeat every ~5s until `done:true`; ~10–35s by thread size):
```js
JSON.stringify({done:window.__waDone===true,count:window.__waRows?window.__waRows.length:0,earliest:window.__waRows&&window.__waRows[0]?window.__waRows[0].ppt:null,latest:window.__waRows&&window.__waRows.length?window.__waRows[window.__waRows.length-1].ppt:null})
```
**Sanity check**: `count>0`, and `(count, earliest, latest)` must NOT equal the previous guest's
(identical ⇒ stale chat ⇒ go back to step 1). `earliest`'s date is the retrievable limit (varies).

**5. Download** (`javascript_tool`) — to `~/Downloads/wa-<guestId>.json`:
```js
(() => {const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(window.__waRows)],{type:'application/json'}));a.download='wa-<guestId>.json';document.body.appendChild(a);a.click();a.remove();return window.__waRows.length;})()
```

**6. Save + clean up** (`Bash`) — idempotent (dedupe-append), then delete the transient file:
```
npx tsx scripts/whatsapp-thread.ts save --guest <guestId> --phone <phone> --rows ~/Downloads/wa-<guestId>.json
rm -f ~/Downloads/wa-<guestId>.json
```
`save` prints `parsed N → +added, total` — record the tally. Update the prior-guest `lastPpt` to
this guest's `latest` and move on.

## Guards (why each step exists)
- **ONE tab** — a 2nd WhatsApp Web tab de-syncs the session.
- **Verify-switch (step 2)** — extracting before the chat switches saves the *previous* guest's thread.
- **Wait-for-done (step 4)** — the extractor's `{}` returns before the scroll finishes; reading early gives `unset`.
- **Idempotent `save`** — re-running a guest only appends genuinely-new messages (safe to retry).
- **Query strings stripped** in the extractor — satisfies the browser's anti-exfil guard + drops tokens.
- **Direction** = the `data-pre-plain-text` sender vs the owner name (`Bogdan Coman`), handled at parse time.

## Error handling
| Symptom | Action |
|---|---|
| Chat didn't switch (step 2 unchanged) | wait 2s, re-check; if still stale, re-run step 1 |
| No chat / "No chats found" for the number | `mark --status no-chat` + continue (records the signal, keeps backfill resumable) |
| `count===0` after done (chat opened but empty/media-only) | re-open + retry once; if still 0, `mark --status empty` + continue |
| Extractor stuck / tool errors 2–3× | stop, report to the user, don't hammer |
| Phone offline (shallow earliest) | note it; deep history needs the phone awake — flag for a later re-run |

## Scale & safety
- ~30–90s per guest (scroll-collect dominates). 100 guests ≈ 1.5–2.5h → run in batches.
- Writes real private conversations to the **admin-locked** `whatsappThreads` collection — do not
  echo sensitive content back verbatim; report tallies/spans, not raw messages.
- If the browser extension disconnects, `tabs_context_mcp` to re-establish; never reuse stale tab ids.
