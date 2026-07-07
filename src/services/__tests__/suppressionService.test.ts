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
  const addMock = jest.fn().mockResolvedValue({ id: 's1' });
  const updateMock = jest.fn().mockResolvedValue(undefined);
  const docRef = { update: updateMock };
  const db = {
    collection: jest.fn((name: string) => ({
      add: addMock,
      doc: jest.fn(() => docRef),
    })),
  };
  return { db, addMock, updateMock };
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
  it('writes a suppressionList entry with the normalized email', async () => {
    const { db, addMock } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    await addSuppression({ email: 'A@B.COM ', reason: 'bounce', source: 'test' });
    expect(addMock).toHaveBeenCalledTimes(1);
    expect(addMock.mock.calls[0][0]).toMatchObject({ email: 'a@b.com', reason: 'bounce', channel: 'all' });
  });
  it('is a no-op when neither phone nor email is provided', async () => {
    const { db, addMock } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    await addSuppression({ reason: 'manual', source: 'test' });
    expect(addMock).not.toHaveBeenCalled();
  });
});

describe('handleInboundStop', () => {
  it('suppresses the phone and marks the guest unsubscribed', async () => {
    const { db, addMock, updateMock } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    mockFindGuestByPhone.mockResolvedValue({ id: 'g1', normalizedPhone: '+40712345678' });

    const res = await handleInboundStop('whatsapp:+40712345678');

    expect(res.suppressed).toBe(true);
    expect(res.normalizedPhone).toBe('+40712345678');
    expect(addMock).toHaveBeenCalledTimes(1);
    expect(addMock.mock.calls[0][0]).toMatchObject({ normalizedPhone: '+40712345678', reason: 'stop-keyword' });
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock.mock.calls[0][0]).toMatchObject({ unsubscribed: true });
  });

  it('still suppresses when no guest record matches', async () => {
    const { db, addMock, updateMock } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    mockFindGuestByPhone.mockResolvedValue(null);

    const res = await handleInboundStop('+40712345678');
    expect(res.suppressed).toBe(true);
    expect(addMock).toHaveBeenCalledTimes(1);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('returns not-suppressed for an unparseable phone', async () => {
    const { db, addMock } = makeDb();
    mockGetAdminDb.mockResolvedValue(db);
    const res = await handleInboundStop('not-a-phone');
    expect(res.suppressed).toBe(false);
    expect(addMock).not.toHaveBeenCalled();
  });
});
