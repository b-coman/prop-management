#!/usr/bin/env npx tsx
/**
 * import-whatsapp-export — ingest an OFFICIAL WhatsApp "Export chat" file into the vault.
 *
 * The phone export (_chat.txt inside the per-chat zip) is the COMPLETE verbatim history — far
 * richer than the desktop scrape (e.g. Razvan/Loredana: 88 msgs vs 1). It also captures the
 * owner's real sent messages, which feed voice-learning. This parses that file, matches it to a
 * guest by the phone number in the zip filename, archives the raw batch, and reconciles it into
 * `whatsappThreads`.
 *
 * The export is AUTHORITATIVE but not assumed complete: it supersedes stored duplicates (matched
 * loosely, since the scrape only knows the minute) while RESCUING anything the vault holds that the
 * export lacks. An export reflects one device at one moment — a restored phone or a disappearing-
 * messages timer yields a legitimately short file, and the vault may be the only surviving copy.
 * Shrink / starts-later warnings are printed so a trimmed export is visible rather than silent.
 *
 * Usage:
 *   npx tsx scripts/import-whatsapp-export.ts <file.zip | _chat.txt | dir-of-zips>
 *          [--guest <id>] [--create-lead [--property <slug>]] [--dry-run]
 *
 * `--create-lead` opens a lead record for a number that has never booked, so a direct enquiry has
 * somewhere to land instead of being skipped.
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
import { upsertThreadMessages, archiveImport } from '../src/services/whatsappThreadService';
import { createLead, cleanPushName } from '../src/services/leadService';
import { isSystemNotice } from '../src/lib/whatsapp/parse-thread';
import type { WhatsAppMessage } from '../src/types';

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const INPUT = process.argv[2];
const GUEST_OVERRIDE = arg('guest');
const DRY = process.argv.includes('--dry-run');
const CREATE_LEAD = process.argv.includes('--create-lead');
const LEAD_PROPERTY = arg('property');
const OWNER = process.env.WHATSAPP_OWNER_NAME || 'Bogdan Coman';

if (!INPUT || INPUT.startsWith('--')) { console.error('usage: import-whatsapp-export <file.zip|_chat.txt|dir> [--guest <id>] [--dry-run]'); process.exit(2); }

const digits = (s: string) => (s || '').replace(/[^0-9]/g, '');
const stripQuery = (t: string) => t.replace(/(https?:\/\/[^\s?]+)\?[^\s]*/g, '$1'); // drop URL query strings (clean vault)

// The header tolerates a MISSING space after the colon — WhatsApp emits bare `[ts] Sender:` lines
// (stripped system events). Matching them keeps their (empty) body from being glued onto the
// PREVIOUS message as a continuation line.
const START = /^‎?\[(\d\d)\.(\d\d)\.(\d\d), (\d\d):(\d\d):(\d\d)\] ([^:]+):[ \t]?([\s\S]*)$/;
const MEDIA = /(image|video|audio|document|GIF|sticker|Contact card) omitted|Missed (voice|video) call/i;

function parseChat(raw: string): WhatsAppMessage[] {
  const out: WhatsAppMessage[] = [];
  let dropping = false;   // inside a system notice — swallow its continuation lines too

  for (const ln of raw.split(/\r?\n/)) {
    const m = ln.match(START);
    if (m) {
      const [, dd, mm, yy, hh, mi, ss, senderRaw, textRaw] = m;
      const text = textRaw.replace(/^‎/, '');
      if (isSystemNotice(text)) { dropping = true; continue; }  // chat event, not a message
      dropping = false;
      const sender = senderRaw.replace(/^~/, '').trim();
      out.push({
        ts: `20${yy}-${mm}-${dd}T${hh}:${mi}:${ss}`,   // phone-local = Bucharest, matches the scrape format
        direction: sender === OWNER ? 'out' : 'in',
        sender,
        text: stripQuery(text),
        type: 'text',                                   // classified below, over the joined body
      });
    } else if (!dropping && out.length) {
      // Continuation line — appended even when blank, so paragraph breaks inside a message survive.
      out[out.length - 1].text += '\n' + stripQuery(ln.replace(/^‎/, ''));
    }
  }

  return out
    .map((m) => ({ ...m, text: m.text.replace(/\n{3,}/g, '\n\n').trim() }))
    .filter((m) => m.text.length > 0)   // bare `[ts] Sender:` artifacts carry no content
    .map((m) => ({
      ...m,
      type: MEDIA.test(m.text) ? 'media' : /https?:\/\//.test(m.text) ? 'link' : 'text',
    }));
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

  // Nobody by this number has ever stayed — it is a LEAD. Without a record the chat has nowhere to
  // land at all, so `--create-lead` opens one and the conversation is kept from the first contact.
  if (!guest && CREATE_LEAD && phone9.length === 9 && !DRY) {
    const e164 = `+${digits(path.basename(file))}`;
    const sorted = [...msgs].sort((a, b) => a.ts.localeCompare(b.ts));
    const theirName = cleanPushName(sorted.find((m) => m.direction === 'in')?.sender);   // may be empty — many leads have no name at all
    const res = await createLead({
      phone: e164,
      name: theirName,
      leadSource: 'whatsapp',
      propertyId: LEAD_PROPERTY,
      firstContactAt: sorted[0]?.ts.slice(0, 10),
    });
    guest = { id: res.id, name: theirName || e164, phone: e164 };
    console.log(`\n${res.created ? 'LEAD CREATED' : 'lead exists'} ${guest.name} [${guest.id}]${theirName ? '' : ' (no name — WhatsApp gave only the number)'}`);
    if (!LEAD_PROPERTY) console.log('  ⚠ no --property given: this lead belongs to no property yet and will not appear in any audience');
  }

  if (!guest) {
    console.log(`SKIP  ${label} — no guest matches this phone (use --create-lead for a new lead, or --guest <id> to force)`);
    return;
  }

  const sorted = [...msgs].sort((a, b) => a.ts.localeCompare(b.ts));
  const outCount = msgs.filter((m) => m.direction === 'out' && m.type === 'text').length;
  const inCount = msgs.filter((m) => m.direction === 'in' && m.type === 'text').length;
  console.log(`\n${guest.name} [${guest.id}]  ← ${label}`);
  console.log(`  parsed: ${msgs.length} msgs (${textMsgs.length} text, ${msgs.length - textMsgs.length} media) · ${outCount} owner-sent, ${inCount} inbound · ${sorted[0]?.ts.slice(0, 10)}→${sorted[sorted.length - 1]?.ts.slice(0, 10)}`);
  if (DRY) { console.log('  (dry-run — not written)'); return; }

  // Archive the raw batch FIRST — the thread doc is derived and can be rebuilt from these.
  const importId = await archiveImport({ guestId: guest.id, phone: guest.phone, source: 'export', label: path.basename(file), messages: msgs });

  const res = await upsertThreadMessages({ guestId: guest.id, phone: guest.phone, messages: msgs, authoritative: true });
  const r = res.reconcile;
  console.log(`  vault → ${res.total} messages (${res.added >= 0 ? '+' : ''}${res.added}) · archived as ${importId}`);
  if (r && r.supersededCount) console.log(`  ${r.supersededCount} stored message(s) superseded by the richer export capture`);
  if (r && r.rescued.length) {
    console.log(`  ⚠ ${r.rescued.length} stored message(s) are NOT in this export — kept, not dropped (${r.rescued[0].ts.slice(0, 10)}→${r.rescued[r.rescued.length - 1].ts.slice(0, 10)})`);
  }
  if (r && r.shrinks) console.log(`  ⚠ this export is SMALLER than what was stored (${r.incomingCount} vs ${r.existingCount}) — likely a trimmed device or a disappearing-messages timer`);
  if (r && r.startsLater) console.log(`  ⚠ this export starts at ${r.incomingEarliest?.slice(0, 16).replace('T', ' ')} but the vault holds history from ${r.existingEarliest?.slice(0, 16).replace('T', ' ')} — older history is phone-side gone`);
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
