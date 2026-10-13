// Configure the cleaning watch for a property: propertySecrets/{propertyId}.cleaningWatch.
// See plans/cleaning-watch.md and src/services/cleaningWatchService.ts.
//
// Usage:
//   npx tsx scripts/cleaning-watch-setup.ts <propertyId> --show
//   npx tsx scripts/cleaning-watch-setup.ts <propertyId> --set label=Coltei --set cleanerName=Mihaela \
//       --set ownerPhone=+40723200868 [--set cleanerPhone=+40...]
//   npx tsx scripts/cleaning-watch-setup.ts <propertyId> --coltei-defaults   (weekly message + shortcut times)
//   npx tsx scripts/cleaning-watch-setup.ts <propertyId> --enable | --disable
//   npx tsx scripts/cleaning-watch-setup.ts <propertyId> --json 'shortcuts=[...]' --json watchCleanings=false
//   npx tsx scripts/cleaning-watch-setup.ts <propertyId> --nuki-list          (locks + recent log names)
//   npx tsx scripts/cleaning-watch-setup.ts <propertyId> --nuki <smartlockId> --cleaner-names "Mihaela"
//
// --nuki-list reads NUKI_API_TOKEN from the environment, else from Secret Manager via gcloud.
import * as dotenv from 'dotenv';
import * as path from 'path';
import { execSync } from 'child_process';
import * as admin from 'firebase-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH not set in .env.local');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(path.resolve(serviceAccountPath)) });
const db = admin.firestore();

const SET_KEYS = new Set(['label', 'cleanerName', 'cleanerPhone', 'ownerPhone']);
const JSON_KEYS = new Set(['watchCleanings', 'shortcuts', 'weeklyMessage', 'nuki']);

function nukiToken(): string {
  const fromEnv = process.env.NUKI_API_TOKEN?.trim();
  if (fromEnv && fromEnv !== 'unset') return fromEnv;
  const fromSecret = execSync('gcloud secrets versions access latest --secret=NUKI_API_TOKEN', { encoding: 'utf8' }).trim();
  if (!fromSecret || fromSecret === 'unset') throw new Error('NUKI_API_TOKEN is not set yet');
  return fromSecret;
}

async function nuki(pathAndQuery: string) {
  const res = await fetch(`https://api.nuki.io${pathAndQuery}`, { headers: { Authorization: `Bearer ${nukiToken()}`, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Nuki ${pathAndQuery}: HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const [propertyId, ...args] = process.argv.slice(2);
  if (!propertyId) {
    console.error('Usage: npx tsx scripts/cleaning-watch-setup.ts <propertyId> [--show] [--set k=v] [--coltei-defaults] [--enable|--disable] [--nuki-list] [--nuki <id> --cleaner-names "A,B"]');
    process.exit(1);
  }
  const ref = db.collection('propertySecrets').doc(propertyId);
  const current = ((await ref.get()).data()?.cleaningWatch ?? {}) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--set') {
      const [k, ...rest] = (args[++i] || '').split('=');
      if (!SET_KEYS.has(k)) throw new Error(`--set only takes ${[...SET_KEYS].join(', ')}`);
      patch[k] = rest.join('=') || null;
    } else if (a === '--json') {
      const [k, ...rest] = (args[++i] || '').split('=');
      if (!JSON_KEYS.has(k)) throw new Error(`--json only takes ${[...JSON_KEYS].join(', ')}`);
      patch[k] = JSON.parse(rest.join('='));
    } else if (a === '--enable') {
      patch.enabled = true;
    } else if (a === '--disable') {
      patch.enabled = false;
    } else if (a === '--coltei-defaults') {
      const name = (patch.cleanerName || current.cleanerName || 'cleaner') as string;
      patch.weeklyMessage = { weekday: 0, time: '17:00' };
      patch.shortcuts = [
        { op: 'weeklySchedule', weekdays: [0], time: '17:00', label: `programul de duminica pentru ${name}` },
        { op: 'cleaningReminder', weekdays: [0, 1, 2, 3, 4, 5, 6], time: '08:30', label: `reminderul de dimineata pentru ${name}` },
      ];
    } else if (a === '--nuki') {
      const smartlockId = Number(args[++i]);
      if (!Number.isInteger(smartlockId)) throw new Error('--nuki needs the numeric smartlockId (see --nuki-list)');
      const namesArg = args.indexOf('--cleaner-names');
      const cleanerNames = namesArg >= 0 ? args[namesArg + 1].split(',').map(s => s.trim()).filter(Boolean) : [current.cleanerName as string];
      patch.nuki = { smartlockId, cleanerNames };
    } else if (a === '--cleaner-names') {
      i++; // read by --nuki
    } else if (a === '--nuki-list') {
      const locks = await nuki('/smartlock') as { smartlockId: number; name: string; serverState: number; state?: Record<string, unknown> }[];
      for (const l of locks) {
        console.log(`smartlockId ${l.smartlockId}  "${l.name}"  serverState ${l.serverState} (0 = online)  battery critical: ${l.state?.batteryCritical}`);
        const logs = await nuki(`/smartlock/${l.smartlockId}/log?limit=20`) as { date: string; action: number; name: string; state: number }[];
        for (const g of logs) console.log(`   ${g.date}  action ${g.action}  state ${g.state}  "${g.name}"`);
      }
    } else if (a !== '--show') {
      throw new Error(`Unknown argument ${a}`);
    }
  }

  if (Object.keys(patch).length) {
    await ref.set({ propertyId, cleaningWatch: { ...current, ...patch } }, { merge: true });
    console.log('Updated.');
  }
  console.log(JSON.stringify(((await ref.get()).data()?.cleaningWatch) ?? null, null, 2));
}

main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
