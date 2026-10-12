// src/services/nukiClient.ts
// Read-only access to the Nuki Web API: a lock's state and its activity log.
//
// The token (NUKI_API_TOKEN) should carry only the smartlock.readOnly and smartlock.log scopes, so
// neither this code nor anyone who gets hold of the token can open the door. The lock must have
// Remote Access (the Smart Lock Go needs the one-time purchase) or Nuki Web never hears from it.
//
// Docs: https://api.nuki.io (Swagger)

import 'server-only';
import type { LockEvent } from '@/lib/cleaning-watch';

const API = 'https://api.nuki.io';
const PAGE = 50; // the API's maximum
const MAX_PAGES = 10;

export interface NukiSmartlock {
  smartlockId: number;
  name: string;
  /** 0 ok, 1 unregistered, 2 auth uuid invalid, 3 auth invalid, 4 offline. */
  serverState: number;
  state?: {
    batteryCritical?: boolean;
    batteryCharge?: number;
    keypadBatteryCritical?: boolean;
  };
}

interface NukiLog {
  id: string;
  date: string;
  action: number;
  state: number;
  name?: string;
}

function token(): string | null {
  const t = process.env.NUKI_API_TOKEN?.trim();
  // The secret exists from day one with the placeholder "unset", so deploys never need it changed.
  return t && t !== 'unset' ? t : null;
}

export function nukiConfigured(): boolean {
  return token() !== null;
}

async function get<T>(path: string): Promise<T> {
  const t = token();
  if (!t) throw new Error('NUKI_API_TOKEN not set');
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${t}`, Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Nuki API ${path.split('?')[0]}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function listSmartlocks(): Promise<NukiSmartlock[]> {
  return get<NukiSmartlock[]>('/smartlock');
}

export function getSmartlock(smartlockId: number): Promise<NukiSmartlock> {
  return get<NukiSmartlock>(`/smartlock/${smartlockId}`);
}

/** The lock's log since `from`, oldest first. Pages back through older entries as needed. */
export async function getSmartlockLog(smartlockId: number, from: Date): Promise<LockEvent[]> {
  const byId = new Map<string, NukiLog>();
  let olderThan: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const query = new URLSearchParams({ fromDate: from.toISOString(), limit: String(PAGE) });
    if (olderThan) query.set('id', olderThan);
    const logs = await get<NukiLog[]>(`/smartlock/${smartlockId}/log?${query}`);
    for (const l of logs) byId.set(l.id, l);
    if (logs.length < PAGE) break;
    const oldest = logs.reduce((a, b) => (a.date < b.date ? a : b));
    if (new Date(oldest.date) <= from || oldest.id === olderThan) break;
    olderThan = oldest.id;
  }
  return [...byId.values()]
    .map(l => ({ at: new Date(l.date), action: l.action, state: l.state, name: l.name || '' }))
    .filter(e => !isNaN(e.at.getTime()))
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}
