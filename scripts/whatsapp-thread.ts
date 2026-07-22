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
// EXTRACTOR (run in WhatsApp Web via the browser js tool). The js tool truncates its
// return at ~1KB, so DON'T return the rows — have the page DOWNLOAD them to a file
// (one call per guest, no chunking; a Blob download is not a JS modal, so it doesn't
// block the extension), then point `--rows` at ~/Downloads/wa-<guestId>.json. URL query
// strings are stripped (path-only) to satisfy the browser's anti-exfil guard and drop
// tokens; whitespace is collapsed to keep the file small (the parser does both anyway).
//   (() => {
//     const rows = [...document.querySelectorAll('[data-pre-plain-text]')].map(el => ({
//       ppt: el.getAttribute('data-pre-plain-text'),
//       text: (el.innerText||'').replace(/(https?:\/\/[^\s?]+)\?[^\s]*/g,'$1').replace(/\s+/g,' ').trim()
//     }));
//     const a = document.createElement('a');
//     a.href = URL.createObjectURL(new Blob([JSON.stringify(rows)], {type:'application/json'}));
//     a.download = 'wa-<guestId>.json'; document.body.appendChild(a); a.click(); a.remove();
//     return rows.length;
//   })()
// For a FULL backfill, first click "get older messages from your phone" and wait for the
// history to load before extracting; for an incremental top-up the recent tail is enough.
//
// Usage:
//   npx tsx scripts/whatsapp-thread.ts queue [--lang ro|en|all] [--missing]
//   npx tsx scripts/whatsapp-thread.ts save --guest <id> --phone <e164> --rows <file.json> [--owner "Bogdan Coman"] [--fmt MDY|DMY]
//   npx tsx scripts/whatsapp-thread.ts show --guest <id>
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getBackfillQueue, upsertThreadMessages, getThread } from '../src/services/whatsappThreadService';
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
