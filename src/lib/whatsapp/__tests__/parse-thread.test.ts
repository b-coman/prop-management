import { parseWhatsAppRows, mergeMessages, type RawRow } from '../parse-thread';
import type { WhatsAppMessage } from '@/types';

const OWNER = 'Bogdan Coman';
const opts = { ownerName: OWNER } as const;

// Fixtures shaped exactly like the real data-pre-plain-text values pulled from the live DOM.
const rows: RawRow[] = [
  { ppt: '[12:14, 10/31/2025] Bogdan Coman: ', text: 'Salut Dragos!!… in jurul focului' },
  { ppt: '[16:47, 2/10/2026] Bogdan Coman: ', text: 'pentru 20-23 feb, 3 nopti, 1750 lei' },
  { ppt: '[16:51, 2/10/2026] +40 722 629 587: ', text: 'Multumim! Revin în cca 2 zile pt confirmare.' },
  { ppt: '[16:09, 7/20/2026] Bogdan Coman: ', text: 'totul ok, ati ajuns?' },
];

describe('parseWhatsAppRows', () => {
  it('parses timestamp (MDY, 24h) into a sortable Bucharest wall-clock string', () => {
    const out = parseWhatsAppRows(rows, opts);
    expect(out[0].ts).toBe('2025-10-31T12:14:00');
    expect(out.find((m) => m.text.includes('20-23 feb'))!.ts).toBe('2026-02-10T16:47:00');
  });

  it('derives direction from the sender (owner → out, guest → in)', () => {
    const out = parseWhatsAppRows(rows, opts);
    const owner = out.find((m) => m.text.includes('20-23 feb'))!;
    const guest = out.find((m) => m.text.includes('Revin în'))!;
    expect(owner.direction).toBe('out');
    expect(guest.direction).toBe('in');
    expect(guest.sender).toBe('+40 722 629 587');
  });

  it('returns messages sorted chronologically', () => {
    const out = parseWhatsAppRows(rows, opts);
    const ts = out.map((m) => m.ts);
    expect(ts).toEqual([...ts].sort());
  });

  it('handles 12-hour AM/PM times', () => {
    const out = parseWhatsAppRows(
      [
        { ppt: '[9:05 PM, 3/4/2026] Bogdan Coman: ', text: 'seara' },
        { ppt: '[12:30 AM, 1/1/2026] X: ', text: 'noapte' },
        { ppt: '[12:15 PM, 1/1/2026] X: ', text: 'pranz' },
      ],
      opts
    );
    expect(out.find((m) => m.text === 'seara')!.ts).toBe('2026-03-04T21:05:00');
    expect(out.find((m) => m.text === 'noapte')!.ts).toBe('2026-01-01T00:30:00');
    expect(out.find((m) => m.text === 'pranz')!.ts).toBe('2026-01-01T12:15:00');
  });

  it('respects DMY date order when configured', () => {
    const out = parseWhatsAppRows([{ ppt: '[10:00, 31/10/2025] Z: ', text: 'x' }], { ownerName: OWNER, dateFormat: 'DMY' });
    expect(out[0].ts).toBe('2025-10-31T10:00:00');
  });

  it('skips rows without a parseable data-pre-plain-text, and empty-text rows', () => {
    const out = parseWhatsAppRows(
      [
        { ppt: null, text: 'an image / media bubble' },
        { ppt: '[10:00, 1/2/2026] Bogdan Coman: ', text: '   ' },
        { ppt: 'garbage', text: 'nope' },
        { ppt: '[10:01, 1/2/2026] Bogdan Coman: ', text: 'kept' },
      ],
      opts
    );
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('kept');
  });

  it('collapses whitespace and dedupes identical messages within a batch', () => {
    const out = parseWhatsAppRows(
      [
        { ppt: '[10:00, 1/2/2026] Bogdan Coman: ', text: 'hello   there' },
        { ppt: '[10:00, 1/2/2026] Bogdan Coman: ', text: 'hello there' }, // dup after whitespace collapse
      ],
      opts
    );
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('hello there');
  });
});

describe('mergeMessages (incremental top-up)', () => {
  const base = parseWhatsAppRows(rows, opts);

  it('appends only genuinely-new messages', () => {
    const incoming: WhatsAppMessage[] = [
      ...base.slice(-1), // already stored → must not duplicate
      { ts: '2026-07-21T09:00:00', direction: 'in', sender: '+40 722 629 587', text: 'multumim, a fost minunat!', type: 'text' },
    ];
    const merged = mergeMessages(base, incoming);
    expect(merged).toHaveLength(base.length + 1);
    expect(merged.at(-1)!.text).toBe('multumim, a fost minunat!');
  });

  it('is idempotent — re-merging the same batch is a no-op', () => {
    expect(mergeMessages(base, base)).toHaveLength(base.length);
  });

  it('keeps the union sorted chronologically', () => {
    const merged = mergeMessages(base, [
      { ts: '2025-01-01T08:00:00', direction: 'out', sender: OWNER, text: 'earliest', type: 'text' },
    ]);
    expect(merged[0].text).toBe('earliest');
    expect(merged.map((m) => m.ts)).toEqual([...merged.map((m) => m.ts)].sort());
  });
});
