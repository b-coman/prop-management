#!/usr/bin/env npx tsx
/**
 * import-whatsapp-export — ingest an OFFICIAL WhatsApp "Export chat" file into the vault.
 *
 * The phone export (_chat.txt inside the per-chat zip) is the COMPLETE verbatim history — far
 * richer than the desktop scrape (e.g. Razvan/Loredana: 88 msgs vs 1). It also captures the
 * owner's real sent messages, which feed voice-learning. This parses that file, matches it to a
 * guest by the phone number in the zip filename, and merges it into `whatsappThreads` (dedup +
 * sort via upsertThreadMessages — safe to re-run).
 *
 * Usage:
 *   npx tsx scripts/import-whatsapp-export.ts <file.zip | _chat.txt | dir-of-zips> [--guest <id>] [--dry-run]
 *
 * Export format (phone app): `[DD.MM.YY, HH:MM:SS] Sender: text` + continuation lines; the owner's
 * sender name is WHATSAPP_OWNER_NAME (default "Bogdan Coman"); "~Name" = the guest. Media/system
 * lines ("image omitted", "Missed voice call", the E2E notice) are kept as type 'media'/skipped.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { getAdminDb } from '../src/lib/firebaseAdminSafe';
import { upsertThreadMessages } from '../src/services/whatsappThreadService';
import type { WhatsAppMessage } from '../src/types';

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const INPUT = process.argv[2];
const GUEST_OVERRIDE = arg('guest');
const DRY = process.argv.includes('--dry-run');
const OWNER = process.env.WHATSAPP_OWNER_NAME || 'Bogdan Coman';

if (!INPUT || INPUT.startsWith('--')) { console.error('usage: import-whatsapp-export <file.zip|_chat.txt|dir> [--guest <id>] [--dry-run]'); process.exit(2); }

const digits = (s: string) => (s || '').replace(/[^0-9]/g, '');
const stripQuery = (t: string) => t.replace(/(https?:\/\/[^\s?]+)\?[^\s]*/g, '$1'); // drop URL query strings (clean vault)

const START = /^‎?\[(\d\d)\.(\d\d)\.(\d\d), (\d\d):(\d\d):(\d\d)\] ([^:]+): ([\s\S]*)$/;
const MEDIA = /(image|video|audio|document|GIF|sticker|Contact card) omitted|Missed (voice|video) call/i;
const SYSTEM = /end-to-end encrypted|changed to a new number|created group|added you|security code/i;

function parseChat(raw: string): WhatsAppMessage[] {
  const out: WhatsAppMessage[] = [];
  for (const ln of raw.split(/\r?\n/)) {
    const m = ln.match(START);
    if (m) {
      const [, dd, mm, yy, hh, mi, ss, senderRaw, textRaw] = m;
      const sender = senderRaw.replace(/^~/, '').trim();
      const text = textRaw.replace(/^‎/, '');
      if (SYSTEM.test(text)) continue; // drop the encryption / system notices
      out.push({
        ts: `20${yy}-${mm}-${dd}T${hh}:${mi}:${ss}`,   // phone-local = Bucharest, matches the scrape format
        direction: sender === OWNER ? 'out' : 'in',
        sender,
        text: stripQuery(text),
        type: MEDIA.test(text) ? 'media' : /https?:\/\//.test(text) ? 'link' : 'text',
      });
    } else if (out.length && ln.length) {
      out[out.length - 1].text += '\n' + stripQuery(ln.replace(/^‎/, '')); // continuation line
    }
  }
  return out;
}

function readChatText(file: string): string {
  if (file.endsWith('.zip')) return execSync(`unzip -p ${JSON.stringify(file)} _chat.txt`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return fs.readFileSync(file, 'utf8');
}

async function importOne(file: string, guestByPhone: Map<string, { id: string; name: string; phone: string }>) {
  const raw = readChatText(file);
  const msgs = parseChat(raw);
  const textMsgs = msgs.filter((m) => m.type !== 'media');
  const phone9 = digits(path.basename(file)).slice(-9);

  let guest = GUEST_OVERRIDE ? [...guestByPhone.values()].find((g) => g.id === GUEST_OVERRIDE) : guestByPhone.get(phone9);
  const label = `${path.basename(file)}  (phone …${phone9})`;
  if (!guest) { console.log(`SKIP  ${label} — no guest matches this phone (use --guest <id> to force)`); return; }

  const outCount = msgs.filter((m) => m.direction === 'out' && m.type === 'text').length;
  console.log(`\n${guest.name} [${guest.id}]  ← ${label}`);
  console.log(`  parsed: ${msgs.length} msgs (${textMsgs.length} text, ${msgs.length - textMsgs.length} media) · ${outCount} owner-sent · ${msgs[0]?.ts.slice(0,10)}→${msgs[msgs.length-1]?.ts.slice(0,10)}`);
  if (DRY) { console.log('  (dry-run — not written)'); return; }
  // The official export is the COMPLETE, clean history → REPLACE the (partial, artifact-laden) scrape.
  const res = await upsertThreadMessages({ guestId: guest.id, phone: guest.phone, messages: msgs, replace: true });
  console.log(`  replaced → ${res.total} messages in vault (was scrape/partial)`);
}

async function main() {
  const db = await getAdminDb();
  const gs = await db.collection('guests').get();
  const guestByPhone = new Map<string, { id: string; name: string; phone: string }>();
  gs.docs.forEach((d) => {
    const g: any = d.data();
    const p9 = digits(g.normalizedPhone || g.phone || '').slice(-9);
    if (p9.length === 9) guestByPhone.set(p9, { id: d.id, name: [g.firstName, g.lastName].filter(Boolean).join(' ') || d.id, phone: g.normalizedPhone || g.phone });
  });

  const stat = fs.statSync(INPUT);
  const files = stat.isDirectory()
    ? fs.readdirSync(INPUT).filter((f) => f.endsWith('.zip') || f.endsWith('.txt')).map((f) => path.join(INPUT, f))
    : [INPUT];
  console.log(`importing ${files.length} file(s)${DRY ? ' (dry-run)' : ''} · owner="${OWNER}"`);
  for (const f of files) await importOne(f, guestByPhone);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
