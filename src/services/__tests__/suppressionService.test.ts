/** @jest-environment node */

jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  FieldValue: { serverTimestamp: jest.fn(() => 'ts') },
}));
jest.mock('@/services/guestService', () => ({ findGuestByPhone: jest.fn() }));

import { isStopKeyword, addSuppression, handleInboundStop } from '../suppressionService';
import { getAdminDb } from '@/lib/firebaseAdminSafe';
import { findGuestByPhone } from '@/services/guestService';

const mockGetAdminDb = getAdminDb as jest.Mock;
const mockFindGuestByPhone = findGuestByPhone as jest.Mock;

function makeDb() {
  const setMock = jest.fn().mockResolvedValue(undefined); // deterministic-id .set(merge)
  const updateMock = jest.fn().mockResolvedValue(undefined);
  const docRef = { set: setMock, update: updateMock };
  const db = { collection: jest.fn(() => ({ doc: jest.fn(() => docRef) })) };
  return { db, setMock, updateMock };
}

beforeEach(() => jest.clearAllMocks());

describe('isStopKeyword', () => {
  it('matches opt-out keywords case/space-insensitively (EN + RO)', () => {
    for (const w of ['STOP', 'stop', '  Stop  ', 'UNSUBSCRIBE', 'stopall', 'oprire', 'dezabonare', 'STOP PROMO']) {
      expect(isStopKeyword(w)).toBe(true);
    }
  });
  it('does not match normal messages', () => {
    for (const w of ['hello', 'stop it there', 'when is check-in?', '', '   ']) {
      expect(isStopKeyword(w)).toBe(false);
    }
  });
});

describe('addSuppression', () => {
  it('writes an idempotent suppressionList entry (deterministic id + merge)', async () => {
    const { db, setMock } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    await addSuppression({ email: 'A@B.COM ', reason: 'bounce', source: 'test' });
    expect(setMock).toHaveBeenCalledTimes(1);
    expect(setMock.mock.calls[0][0]).toMatchObject({ email: 'a@b.com', reason: 'bounce', channel: 'all' });
    expect(setMock.mock.calls[0][1]).toEqual({ merge: true });
  });
  it('is a no-op when neither phone nor email is provided', async () => {
    const { db, setMock } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    await addSuppression({ reason: 'manual', source: 'test' });
    expect(setMock).not.toHaveBeenCalled();
  });
});

describe('handleInboundStop', () => {
  it('suppresses the phone and marks the guest unsubscribed', async () => {
    const { db, setMock, updateMock } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    mockFindGuestByPhone.mockResolvedValue({ id: 'g1', normalizedPhone: '+40712345678' });

    const res = await handleInboundStop('whatsapp:+40712345678');

    expect(res.suppressed).toBe(true);
    expect(res.normalizedPhone).toBe('+40712345678');
    expect(setMock).toHaveBeenCalledTimes(1);
    expect(setMock.mock.calls[0][0]).toMatchObject({ normalizedPhone: '+40712345678', reason: 'stop-keyword' });
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0][0]).toMatchObject({ unsubscribed: true });
  });

  it('still suppresses when no guest record matches', async () => {
    const { db, setMock, updateMock } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    mockFindGuestByPhone.mockResolvedValue(null);

    const res = await handleInboundStop('+40712345678');
    expect(res.suppressed).toBe(true);
    expect(setMock).toHaveBeenCalledTimes(1);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('returns not-suppressed for an unparseable phone', async () => {
    const { db, setMock } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    const res = await handleInboundStop('not-a-phone');
    expect(res.suppressed).toBe(false);
    expect(setMock).not.toHaveBeenCalled();
  });
});
