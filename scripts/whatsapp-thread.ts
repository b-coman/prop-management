// WhatsApp thread backfill — operator CLI bridging the (Claude-driven) browser
// extraction to the tested server service. The heavy lifting lives in
// src/lib/whatsapp/parse-thread.ts (pure) + src/services/whatsappThreadService.ts;
// this is a thin, resumable wrapper.
//
// Flow per guest (one-time backfill, then incremental top-ups before a campaign):
//   1. `queue`  → the work-list (RO guests w/ a phone, thread status)
//   2. In WhatsApp Web (single tab, settled): search the phone → open → for a full
//      backfill click "get older messages from your phone" and wait → run the
//      EXTRACTOR below via the browser js tool; it returns RawRow[] = [{ppt,text}].
//      Save that JSON to a file.
//   3. `save`   → parse + merge + persist (idempotent; dedupes on re-run)
//
// EXTRACTOR (run in WhatsApp Web via the browser js tool). Two hard constraints learned
// in testing: (1) the js tool truncates its return at ~1KB, and (2) WhatsApp VIRTUALIZES
// the message list — only ~50 messages near the scroll position are in the DOM at once,
// so a single querySelectorAll captures ONLY the visible window (this silently truncated
// long threads until caught). You must SCROLL the whole thread and ACCUMULATE (dedup by
// the ppt+text key), stash into a global (a long async returns `{}` through the tool, but
// its side effects run — read the global after), then DOWNLOAD the global to a file (a
// Blob download is not a JS modal, so it won't block the extension). Point `--rows` at it.
// URL query strings are stripped (anti-exfil guard + token hygiene); whitespace collapsed.
//
//   // 1) scroll-load + collect the FULL thread into window.__waRows (returns {}; read the global after):
//   (async () => {
//     const sleep = ms => new Promise(r => setTimeout(r, ms));
//     let p = document.querySelector('[data-pre-plain-text]');
//     for (let i=0;i<40&&p;i++){ if(p.scrollHeight>p.clientHeight+100 && /(auto|scroll)/.test(getComputedStyle(p).overflowY)) break; p=p.parentElement; }
//     const clean = t => (t||'').replace(/(https?:\/\/[^\s?]+)\?[^\s]*/g,'$1').replace(/\s+/g,' ').trim();
//     const acc = new Map();
//     const grab = () => document.querySelectorAll('[data-pre-plain-text]').forEach(el => { const k=el.getAttribute('data-pre-plain-text'); if(k){ const t=clean(el.innerText); acc.set(k+'||'+t,{ppt:k,text:t}); } });
//     let last=-1, stable=0;                                     // Phase 1: force-load all older
//     for (let i=0;i<30 && stable<4;i++){ p.scrollTop=0; const b=[...document.querySelectorAll('button')].find(e=>/get older messages/i.test(e.textContent||'')); if(b)b.click(); await sleep(600); grab(); if(p.scrollHeight===last) stable++; else {stable=0; last=p.scrollHeight;} }
//     p.scrollTop=0; await sleep(400); grab();                   // Phase 2: walk top->bottom, collecting each window
//     for (let g=0, lt=-1, st=0; g<800; g++){ grab(); if(p.scrollTop>=p.scrollHeight-p.clientHeight-5){grab();break;} p.scrollTop+=Math.floor(p.clientHeight*0.5); await sleep(130); if(p.scrollTop===lt){if(++st>4)break;}else st=0; lt=p.scrollTop; }
//     grab(); window.__waRows=[...acc.values()];
//   })()   // then verify: JSON.stringify({n: window.__waRows.length, first: window.__waRows[0].ppt, last: window.__waRows.at(-1).ppt})
//
//   // 2) download window.__waRows:
//   (() => { const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([JSON.stringify(window.__waRows)],{type:'application/json'})); a.download='wa-<guestId>.json'; document.body.appendChild(a); a.click(); a.remove(); return window.__waRows.length; })()
//
// INCREMENTAL top-up: the recent tail is already rendered, so Phase 2 alone (skip Phase 1)
// suffices; `save` dedupes against the stored thread, appending only genuinely-new messages.
//
// Usage:
//   npx tsx scripts/whatsapp-thread.ts queue [--lang ro|en|all] [--missing]
//   npx tsx scripts/whatsapp-thread.ts save --guest <id> --phone <e164> --rows <file.json> [--owner "Bogdan Coman"] [--fmt MDY|DMY]
//   npx tsx scripts/whatsapp-thread.ts mark --guest <id> --phone <e164> --status no-chat|empty   # record a guest with no retrievable messages
//   npx tsx scripts/whatsapp-thread.ts show --guest <id>
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getBackfillQueue, upsertThreadMessages, getThread, markThread } from '../src/services/whatsappThreadService';
import { parseWhatsAppRows, type RawRow } from '../src/lib/whatsapp/parse-thread';

const DEFAULT_OWNER = process.env.WHATSAPP_OWNER_NAME || 'Bogdan Coman';

function flag(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const cmd = process.argv[2];

  if (cmd === 'queue') {
    const language = (flag('lang') as 'ro' | 'en' | 'all') || 'ro';
    const q = await getBackfillQueue({ language, onlyMissing: has('missing') });
    const todo = q.filter((i) => !i.hasThread).length;
    console.log(`${q.length} guests (${language})${has('missing') ? ' — missing only' : ''} · ${todo} without a thread\n`);
    for (const i of q) {
      const status = i.hasThread ? `✓ ${i.messageCount} msgs, last ${i.lastMessageTs ?? '?'}` : '— (backfill)';
      console.log(`  ${i.guestId.padEnd(24)} ${i.phone.padEnd(15)} ${i.name.padEnd(26)} ${status}`);
    }
    return;
  }

  if (cmd === 'save') {
    const guestId = flag('guest');
    const phone = flag('phone');
    const rowsFile = flag('rows');
    if (!guestId || !phone || !rowsFile) {
      console.error('save requires --guest <id> --phone <e164> --rows <file.json>');
      process.exit(1);
    }
    const rows = JSON.parse(fs.readFileSync(path.resolve(rowsFile), 'utf8')) as RawRow[];
    const messages = parseWhatsAppRows(rows, {
      ownerName: flag('owner') || DEFAULT_OWNER,
      dateFormat: (flag('fmt') as 'MDY' | 'DMY') || 'MDY',
    });
    const res = await upsertThreadMessages({ guestId, phone, messages });
    console.log(`Saved ${guestId}: parsed ${messages.length} messages → +${res.added} new, ${res.total} total.`);
    return;
  }

  if (cmd === 'mark') {
    const guestId = flag('guest');
    const phone = flag('phone');
    const status = flag('status') as 'no-chat' | 'empty';
    if (!guestId || !phone || (status !== 'no-chat' && status !== 'empty')) {
      console.error('mark requires --guest <id> --phone <e164> --status no-chat|empty');
      process.exit(1);
    }
    await markThread(guestId, phone, status);
    console.log(`Marked ${guestId} as ${status}.`);
    return;
  }

  if (cmd === 'show') {
    const guestId = flag('guest');
    if (!guestId) { console.error('show requires --guest <id>'); process.exit(1); }
    const t = await getThread(guestId);
    if (!t) { console.log(`No thread for ${guestId}.`); return; }
    console.log(`${guestId} · ${t.phone} · ${t.messageCount} messages · last ${t.lastMessageTs}`);
    for (const msg of t.messages.slice(-6)) {
      console.log(`  [${msg.ts}] ${msg.direction === 'out' ? '→' : '←'} ${msg.text.slice(0, 70)}`);
    }
    return;
  }

  console.error('Unknown command. Use: queue | save | show');
  process.exit(1);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
