/** @jest-environment node */

// The save path is the dangerous one: this block is read by BOTH the guide page and the guest
// emails, and an upload script once rewrote the whole overrides document. These assert that a
// save touches only `guestGuide`, keeps the keys the editor never shows, and refuses the inputs
// that would silently break the guide.
jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: { serverTimestamp: () => 'server-ts' },
}));
jest.mock('@/lib/authorization', () => ({
  requirePropertyAccess: jest.fn(),
  AuthorizationError: class extends Error {},
}));
jest.mock('@/lib/logger', () => ({ loggers: { admin: { info: jest.fn(), error: jest.fn() } } }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/utils', () => ({ convertTimestampsToISOStrings: (x: any) => x }));

import { saveGuide } from '../actions';
import { getAdminDb } from '@/lib/firebaseAdminSafe';

const set = jest.fn(async () => ({}));
beforeEach(() => {
  jest.clearAllMocks();
  (getAdminDb as jest.Mock).mockResolvedValue({ collection: () => ({ doc: () => ({ set }) }) });
});

const ok = { sections: [{ id: 'things-to-know', title: { ro: 'Bine de știut' } }] };

describe('saveGuide', () => {
  it('writes ONLY under guestGuide, with merge, so other override blocks survive', async () => {
    await saveGuide('p', ok);
    const [payload, options] = set.mock.calls[0] as any[];
    expect(Object.keys(payload).sort()).toEqual(['guestGuide', 'updatedAt']);
    expect(options).toEqual({ merge: true });
  });

  it('carries through keys the editor never shows, so a save cannot drop them', async () => {
    await saveGuide('p', { ...ok, routes: [{ km: 4 }], shareMessage: { ro: 'salut' }, enabled: true } as any);
    const [payload] = set.mock.calls[0] as any[];
    expect(payload.guestGuide.routes).toEqual([{ km: 4 }]);
    expect(payload.guestGuide.shareMessage).toEqual({ ro: 'salut' });
    expect(payload.guestGuide.enabled).toBe(true);
  });

  it('refuses a section with no id — the guide keys off it and would drop the section', async () => {
    const res = await saveGuide('p', { sections: [{ id: '', title: { ro: 'x' } }] });
    expect(res.error).toMatch(/needs an id/i);
    expect(set).not.toHaveBeenCalled();
  });

  it('refuses duplicate section ids', async () => {
    const res = await saveGuide('p', { sections: [{ id: 'a' }, { id: 'a' }] });
    expect(res.error).toMatch(/duplicate/i);
    expect(set).not.toHaveBeenCalled();
  });

  it('refuses a phone that could not be dialled', async () => {
    const res = await saveGuide('p', { ...ok, contacts: [{ phone: 'call me' }] });
    expect(res.error).toMatch(/phone/i);
    expect(set).not.toHaveBeenCalled();
  });

  it('refuses a map link that is not a url — it renders as a dead button', async () => {
    const res = await saveGuide('p', { ...ok, arrival: { wazeUrl: 'waze.com/x' } });
    expect(res.error).toMatch(/must start with http/i);
    expect(set).not.toHaveBeenCalled();
  });

  it('accepts an empty guide rather than blocking a property that has none yet', async () => {
    expect(await saveGuide('p', {})).toEqual({});
    expect(set).toHaveBeenCalled();
  });
});
