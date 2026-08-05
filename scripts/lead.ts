#!/usr/bin/env npx tsx
/**
 * lead — maintain records for people who contacted us directly but never stayed.
 *
 * A lead has no stay, so the material a message can honestly be built on is different: what they
 * ASKED for, and why it did not happen. `--reason` and `request` capture exactly that. Requested
 * periods are also demand telemetry — a window we could not fill is evidence about pricing and
 * calendar pressure that never becomes a booking record.
 *
 * Usage:
 *   lead create  --phone <e164> [--name "..."] [--property <slug>] [--source whatsapp|phone|website]
 *                [--first-contact YYYY-MM-DD] [--lang ro|en]
 *   lead set     (--guest <id> | --phone <e164>) [--name "..."] [--name-source booking|pushname|manual|unknown]
 *                [--reason unavailable|declined|unservable|unresolved] [--property <slug>] [--source ...]
 *   lead request (--guest <id> | --phone <e164>) --start YYYY-MM-DD --end YYYY-MM-DD
 *                [--asked-on YYYY-MM-DD] [--outcome unavailable|declined|booked|unresolved] [--note "..."]
 *   lead list
 *
 * See NonConversionReason in src/types for what each --reason licenses in a later message.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { createLead, updateLead, addRequestedPeriod, listLeads, findByPhone } from '../src/services/leadService';
import type { Guest, NonConversionReason, RequestedPeriod } from '../src/types';

const flag = (n: string): string | undefined => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const today = () => new Date().toISOString().slice(0, 10);

async function resolve(): Promise<{ id: string; label: string } | null> {
  const gid = flag('guest');
  if (gid) return { id: gid, label: gid };
  const phone = flag('phone');
  if (!phone) return null;
  const g = await findByPhone(phone);
  if (!g) { console.error(`No guest/lead with phone ${phone} — create one first`); return null; }
  return { id: g.id, label: [g.firstName, g.lastName].filter(Boolean).join(' ') || g.normalizedPhone || g.id };
}

async function main() {
  const cmd = process.argv[2];

  if (cmd === 'create') {
    const phone = flag('phone');
    if (!phone) { console.error('create requires --phone <e164>'); process.exit(1); }
    const res = await createLead({
      phone,
      name: flag('name'),
      nameSource: flag('name') ? 'manual' : undefined,
      leadSource: flag('source'),
      propertyId: flag('property'),
      firstContactAt: flag('first-contact'),
      language: flag('lang') as Guest['language'],
    });
    if (!res.created) {
      const e = res.existing!;
      console.log(`Already known: ${[e.firstName, e.lastName].filter(Boolean).join(' ') || e.id} [${e.id}] · kind=${e.kind || 'guest'}`);
      return;
    }
    console.log(`Lead created [${res.id}]`);
    if (!flag('property')) console.log('  ⚠ no --property: this lead belongs to no property yet and will not appear in any audience');
    return;
  }

  if (cmd === 'set') {
    const who = await resolve();
    if (!who) { console.error('set requires --guest <id> or --phone <e164>'); process.exit(1); }
    await updateLead(who.id, {
      firstName: flag('name'),
      nameSource: flag('name-source') as Guest['nameSource'],
      leadSource: flag('source'),
      nonConversionReason: flag('reason') as NonConversionReason | undefined,
      propertyId: flag('property'),
      language: flag('lang') as Guest['language'],
    });
    console.log(`Updated ${who.label} [${who.id}]`);
    return;
  }

  if (cmd === 'request') {
    const who = await resolve();
    const start = flag('start'); const end = flag('end');
    if (!who || !start || !end) { console.error('request requires (--guest|--phone) --start YYYY-MM-DD --end YYYY-MM-DD'); process.exit(1); }
    const period: RequestedPeriod = {
      start, end,
      askedOn: flag('asked-on') || today(),
      outcome: (flag('outcome') as RequestedPeriod['outcome']) || 'unresolved',
      ...(flag('note') ? { note: flag('note')! } : {}),
    };
    await addRequestedPeriod(who.id, period);
    console.log(`Recorded ${who.label} [${who.id}] wanted ${start}→${end} · ${period.outcome}`);
    return;
  }

  if (cmd === 'list') {
    const leads = await listLeads();
    console.log(`${leads.length} lead(s)\n`);
    for (const l of leads) {
      const name = [l.firstName, l.lastName].filter(Boolean).join(' ') || '(no name)';
      const req = (l.requestedPeriods || []).map(p => `${p.start}→${p.end} ${p.outcome}`).join('; ');
      console.log(`  ${l.id.padEnd(24)} ${(l.normalizedPhone || '').padEnd(15)} ${name.padEnd(20)} first ${l.firstContactAt || '?'} · ${l.nonConversionReason || 'reason unset'}${req ? ` · ${req}` : ''}`);
    }
    return;
  }

  console.error('Unknown command. Use: create | set | request | list');
  process.exit(1);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
