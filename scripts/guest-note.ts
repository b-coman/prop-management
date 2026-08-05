#!/usr/bin/env npx tsx
/**
 * guest-note — record what happened off-WhatsApp (a phone call, a conversation on site).
 *
 * The engagement layer reads the message vault, so a relationship conducted by phone is invisible
 * to it — and worse than invisible: unanswered outbound messages read as "silent, never replied"
 * for someone who was warm on a call. A note supplies the missing half of the timeline. It counts
 * as a TOUCH for pacing, and — only when marked `--assertable` — it may be used as a fact.
 *
 * Usage:
 *   guest-note add   (--guest <id> | --phone <e164>) --text "..." [--kind call|inperson|observation]
 *                    [--at YYYY-MM-DD] [--by owner|guest] [--assertable] [--fact key=value ...]
 *                    [--expires YYYY-MM-DD]
 *   guest-note list  [(--guest <id> | --phone <e164>)]
 *   guest-note rm    --id <noteId>
 *
 * `--assertable` licenses the copywriter to STATE the note. Leave it off for anything that should
 * only shape tone. `--expires` retires a note whose relevance has a shelf life.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { getAdminDb } from '../src/lib/firebaseAdminSafe';
import { addGuestNote, listGuestNotes, deleteGuestNote, getNotesByGuest } from '../src/services/guestNoteService';
import type { GuestNoteKind } from '../src/types';

const flag = (n: string): string | undefined => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const has = (n: string) => process.argv.includes(`--${n}`);
const all = (n: string): string[] => process.argv.reduce<string[]>((acc, a, i) => (a === `--${n}` && process.argv[i + 1] ? [...acc, process.argv[i + 1]] : acc), []);
const digits = (s: string) => (s || '').replace(/[^0-9]/g, '');

/** Resolve --guest / --phone to a guest id + label. Phone matches on the last 9 digits. */
async function resolveGuest(): Promise<{ id: string; label: string } | null> {
  const gid = flag('guest');
  const phone = flag('phone');
  const db = await getAdminDb();
  if (gid) {
    const d = await db.collection('guests').doc(gid).get();
    if (!d.exists) { console.error(`No guest ${gid}`); return null; }
    const g: any = d.data();
    return { id: d.id, label: [g.firstName, g.lastName].filter(Boolean).join(' ') || d.id };
  }
  if (phone) {
    const p9 = digits(phone).slice(-9);
    const snap = await db.collection('guests').get();
    const hit = snap.docs.find((d) => digits((d.data() as any).normalizedPhone || (d.data() as any).phone || '').slice(-9) === p9);
    if (!hit) { console.error(`No guest/lead with phone …${p9}`); return null; }
    const g: any = hit.data();
    return { id: hit.id, label: [g.firstName, g.lastName].filter(Boolean).join(' ') || hit.id };
  }
  return null;
}

async function main() {
  const cmd = process.argv[2];

  if (cmd === 'add') {
    const who = await resolveGuest();
    const text = flag('text');
    if (!who || !text) { console.error('add requires (--guest <id> | --phone <e164>) and --text "..."'); process.exit(1); }
    const facts = all('fact').map((f) => { const i = f.indexOf('='); return { key: f.slice(0, i), value: f.slice(i + 1) }; }).filter((f) => f.key && f.value);
    const assertable = has('assertable');
    if (facts.length && !assertable) console.warn('note: --fact given without --assertable — the facts will NOT be usable by the copywriter');

    const id = await addGuestNote({
      guestId: who.id,
      text,
      kind: (flag('kind') as GuestNoteKind) || 'call',
      occurredAt: flag('at'),
      initiatedBy: flag('by') as 'owner' | 'guest' | undefined,
      assertable,
      facts,
      expiresAt: flag('expires'),
      createdBy: 'cli',
    });
    console.log(`Noted ${who.label} [${who.id}] → ${id}${assertable ? ' (assertable)' : ' (context-only)'}${facts.length ? ` · ${facts.length} fact(s)` : ''}`);
    return;
  }

  if (cmd === 'list') {
    const who = await resolveGuest();
    if (who) {
      const notes = await listGuestNotes(who.id);
      console.log(`${who.label} [${who.id}] · ${notes.length} note(s)\n`);
      notes.forEach((n) => {
        console.log(`  ${n.id}  ${n.occurredAt}  ${n.kind.padEnd(11)} ${n.assertable ? 'assertable ' : 'context    '}${n.expiresAt ? `expires ${n.expiresAt} ` : ''}`);
        console.log(`     ${n.text}`);
        (n.facts || []).forEach((f) => console.log(`     · note:${f.key} = ${f.value}`));
      });
      return;
    }
    const byGuest = await getNotesByGuest();
    const total = [...byGuest.values()].reduce((s, a) => s + a.length, 0);
    console.log(`${total} note(s) across ${byGuest.size} guest(s)\n`);
    for (const [gid, notes] of byGuest) {
      console.log(`  ${gid.padEnd(24)} ${String(notes.length).padStart(2)} note(s) · latest ${notes[notes.length - 1].occurredAt}`);
    }
    return;
  }

  if (cmd === 'rm') {
    const id = flag('id');
    if (!id) { console.error('rm requires --id <noteId>'); process.exit(1); }
    await deleteGuestNote(id);
    console.log(`Deleted ${id}.`);
    return;
  }

  console.error('Unknown command. Use: add | list | rm');
  process.exit(1);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
