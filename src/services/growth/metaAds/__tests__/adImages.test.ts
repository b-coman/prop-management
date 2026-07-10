/** @jest-environment node */

jest.mock('../adContext', () => ({ resolveAdContext: jest.fn() }));
jest.mock('../client', () => ({ uploadImage: jest.fn() }));
jest.mock('@/lib/firebaseAdminSafe', () => ({
  getAdminDb: jest.fn(),
  getAdminStorage: jest.fn(),
  FieldValue: { serverTimestamp: jest.fn(() => 'server-ts') },
}));

import { createHash } from 'crypto';
import { uploadImageToAccount, getImageWidthPx } from '../adImages';
import { resolveAdContext } from '../adContext';
import { uploadImage } from '../client';
import { getAdminDb, getAdminStorage } from '@/lib/firebaseAdminSafe';

const mockResolveAdContext = resolveAdContext as jest.Mock;
const mockUploadImage = uploadImage as jest.Mock;
const mockGetAdminDb = getAdminDb as jest.Mock;
const mockGetAdminStorage = getAdminStorage as jest.Mock;

const PROPERTY = 'prahova-mountain-chalet';
const AD_ACCOUNT = 'act_543311232953437';

// ---------------------------------------------------------------------------
// Synthetic JPEG/PNG byte builders — just enough header for getImageWidthPx
// to parse; no real pixel data (the parser never looks past the header).
// ---------------------------------------------------------------------------

function u16(n: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16BE(n, 0);
  return b;
}

function makeJpegBytes(width: number, height: number): Buffer {
  const payload = Buffer.concat([
    Buffer.from([8]), // precision
    u16(height),
    u16(width),
    Buffer.from([1]), // num components
    Buffer.from([1, 0x11, 0]), // one component: id, sampling, quant table
  ]);
  const sof0 = Buffer.concat([Buffer.from([0xff, 0xc0]), u16(payload.length + 2), payload]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), sof0, Buffer.from([0xff, 0xd9])]);
}

function makePngBytes(width: number, height: number): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(13, 0);
  const type = Buffer.from('IHDR', 'ascii');
  const w = Buffer.alloc(4);
  w.writeUInt32BE(width, 0);
  const h = Buffer.alloc(4);
  h.writeUInt32BE(height, 0);
  const rest = Buffer.from([8, 6, 0, 0, 0]); // depth, color type, compression, filter, interlace
  const crc = Buffer.alloc(4);
  return Buffer.concat([sig, len, type, w, h, rest, crc]);
}

// ---------------------------------------------------------------------------
// Fake Admin SDK layers
// ---------------------------------------------------------------------------

function makeFakeDb() {
  const store = new Map<string, Record<string, unknown>>();
  const db = {
    collection: jest.fn((name: string) => {
      if (name !== 'adImageCache') throw new Error(`unexpected collection in test: ${name}`);
      return {
        doc: jest.fn((id: string) => ({
          get: jest.fn(async () => ({
            exists: store.has(id),
            data: () => store.get(id),
          })),
          set: jest.fn(async (data: Record<string, unknown>) => {
            store.set(id, data);
          }),
        })),
      };
    }),
  };
  return { db, store };
}

function makeFakeStorage(bytesOrError: Buffer | Error) {
  const download = jest.fn(async () => {
    if (bytesOrError instanceof Error) throw bytesOrError;
    return [bytesOrError];
  });
  const file = jest.fn(() => ({ download }));
  const storage = { bucket: jest.fn(() => ({ file })) };
  return { storage, file, download };
}

const REAL_JPEG = makeJpegBytes(2048, 1536); // matches the §9d spike image
const REAL_HASH = createHash('sha256').update(REAL_JPEG).digest('hex');

beforeEach(() => {
  jest.clearAllMocks();
  mockResolveAdContext.mockResolvedValue({ adAccountId: AD_ACCOUNT, token: 'tok' });
});

describe('getImageWidthPx — minimal JPEG/PNG header parser', () => {
  it('reads width from a JPEG SOF0 marker', () => {
    expect(getImageWidthPx(makeJpegBytes(2048, 1536))).toBe(2048);
  });

  it('reads width from a PNG IHDR chunk', () => {
    expect(getImageWidthPx(makePngBytes(1200, 800))).toBe(1200);
  });

  it('returns undefined for bytes that are neither JPEG nor PNG', () => {
    expect(getImageWidthPx(Buffer.from('not an image'))).toBeUndefined();
  });
});

describe('uploadImageToAccount — no ad context', () => {
  it('returns {ok:false,error:"no-ad-context"} without touching Storage/Firestore/Meta', async () => {
    mockResolveAdContext.mockResolvedValue(null);
    const res = await uploadImageToAccount(PROPERTY, { storagePath: 'properties/x/images/a.jpg' });
    expect(res).toEqual({ ok: false, error: 'no-ad-context' });
    expect(mockGetAdminDb).not.toHaveBeenCalled();
    expect(mockGetAdminStorage).not.toHaveBeenCalled();
    expect(mockUploadImage).not.toHaveBeenCalled();
  });
});

describe('uploadImageToAccount — cache hit (pre-download fast path)', () => {
  it('returns the cached hash and never touches Storage or Meta', async () => {
    const { db, store } = makeFakeDb();
    mockGetAdminDb.mockResolvedValue(db);
    store.set(`meta_543311232953437_${REAL_HASH}`, { imageHash: 'cached-hash-1' });

    const res = await uploadImageToAccount(PROPERTY, {
      storagePath: 'properties/prahova-mountain-chalet/images/a.jpg',
      contentHash: REAL_HASH,
    });

    expect(res).toEqual({ ok: true, data: { imageHash: 'cached-hash-1' } });
    expect(mockGetAdminStorage).not.toHaveBeenCalled();
    expect(mockUploadImage).not.toHaveBeenCalled();
  });
});

describe('uploadImageToAccount — cache miss, upload, and cache write', () => {
  it('downloads, guards, uploads via the client, and writes the cache under the VERIFIED hash', async () => {
    const { db, store } = makeFakeDb();
    mockGetAdminDb.mockResolvedValue(db);
    const { storage, file } = makeFakeStorage(REAL_JPEG);
    mockGetAdminStorage.mockResolvedValue(storage);
    mockUploadImage.mockResolvedValue({ ok: true, data: { imageHash: 'fresh-hash-1' } });

    const res = await uploadImageToAccount(PROPERTY, {
      storagePath: 'properties/prahova-mountain-chalet/images/a.jpg',
    });

    expect(res).toEqual({ ok: true, data: { imageHash: 'fresh-hash-1' } });
    expect(file).toHaveBeenCalledWith('properties/prahova-mountain-chalet/images/a.jpg');
    expect(mockUploadImage).toHaveBeenCalledTimes(1);
    expect(mockUploadImage).toHaveBeenCalledWith(
      AD_ACCOUNT,
      'tok',
      expect.objectContaining({ bytes: REAL_JPEG, filename: 'a.jpg', contentType: 'image/jpeg' }),
      PROPERTY
    );
    // cache written under the accountId-normalized (no "act_"), verified-hash key
    expect(store.get(`meta_543311232953437_${REAL_HASH}`)).toMatchObject({
      platform: 'meta',
      accountId: '543311232953437',
      contentHash: REAL_HASH,
      imageHash: 'fresh-hash-1',
    });
  });

  it('dedups: a second upload of the SAME bytes (no pre-given hash) hits the post-download cache and never re-calls Meta', async () => {
    const { db } = makeFakeDb();
    mockGetAdminDb.mockResolvedValue(db);
    const { storage } = makeFakeStorage(REAL_JPEG);
    mockGetAdminStorage.mockResolvedValue(storage);
    mockUploadImage.mockResolvedValue({ ok: true, data: { imageHash: 'fresh-hash-1' } });

    const first = await uploadImageToAccount(PROPERTY, { storagePath: 'properties/prahova-mountain-chalet/images/a.jpg' });
    const second = await uploadImageToAccount(PROPERTY, { storagePath: 'properties/prahova-mountain-chalet/images/b.jpg' });

    expect(first).toEqual({ ok: true, data: { imageHash: 'fresh-hash-1' } });
    expect(second).toEqual({ ok: true, data: { imageHash: 'fresh-hash-1' } });
    expect(mockUploadImage).toHaveBeenCalledTimes(1); // second call was a cache hit
  });

  it('a stale/wrong caller-supplied contentHash does not prevent finding the real cached entry post-download', async () => {
    const { db, store } = makeFakeDb();
    mockGetAdminDb.mockResolvedValue(db);
    store.set(`meta_543311232953437_${REAL_HASH}`, { imageHash: 'already-cached-hash' });
    const { storage } = makeFakeStorage(REAL_JPEG);
    mockGetAdminStorage.mockResolvedValue(storage);

    const res = await uploadImageToAccount(PROPERTY, {
      storagePath: 'properties/prahova-mountain-chalet/images/a.jpg',
      contentHash: 'not-the-real-hash',
    });

    expect(res).toEqual({ ok: true, data: { imageHash: 'already-cached-hash' } });
    expect(mockUploadImage).not.toHaveBeenCalled(); // recovered via the post-download verified-hash check
  });
});

describe('uploadImageToAccount — size guard (30MB)', () => {
  it('rejects an oversized image before calling Meta', async () => {
    const { db } = makeFakeDb();
    mockGetAdminDb.mockResolvedValue(db);
    const oversized = Buffer.alloc(30 * 1024 * 1024 + 1);
    const { storage } = makeFakeStorage(oversized);
    mockGetAdminStorage.mockResolvedValue(storage);

    const res = await uploadImageToAccount(PROPERTY, { storagePath: 'properties/prahova-mountain-chalet/images/a.jpg' });
    expect(res).toEqual({ ok: false, error: 'image-too-large' });
    expect(mockUploadImage).not.toHaveBeenCalled();
  });
});

describe('uploadImageToAccount — width guard (min 600px)', () => {
  it('rejects an image narrower than 600px before calling Meta', async () => {
    const { db } = makeFakeDb();
    mockGetAdminDb.mockResolvedValue(db);
    const narrow = makeJpegBytes(400, 300);
    const { storage } = makeFakeStorage(narrow);
    mockGetAdminStorage.mockResolvedValue(storage);

    const res = await uploadImageToAccount(PROPERTY, { storagePath: 'properties/prahova-mountain-chalet/images/a.jpg' });
    expect(res).toEqual({ ok: false, error: 'image-too-narrow' });
    expect(mockUploadImage).not.toHaveBeenCalled();
  });

  it('rejects a file whose width cannot be determined (unsupported format)', async () => {
    const { db } = makeFakeDb();
    mockGetAdminDb.mockResolvedValue(db);
    const { storage } = makeFakeStorage(Buffer.from('not an image, no header'));
    mockGetAdminStorage.mockResolvedValue(storage);

    const res = await uploadImageToAccount(PROPERTY, { storagePath: 'properties/prahova-mountain-chalet/images/a.gif' });
    expect(res).toEqual({ ok: false, error: 'image-too-narrow' });
    expect(mockUploadImage).not.toHaveBeenCalled();
  });
});

describe('uploadImageToAccount — Storage failure', () => {
  it('returns a typed failure (never throws) when the Storage download fails', async () => {
    const { db } = makeFakeDb();
    mockGetAdminDb.mockResolvedValue(db);
    const { storage } = makeFakeStorage(new Error('bucket unreachable'));
    mockGetAdminStorage.mockResolvedValue(storage);

    const res = await uploadImageToAccount(PROPERTY, { storagePath: 'properties/prahova-mountain-chalet/images/a.jpg' });
    expect(res).toEqual({ ok: false, error: 'storage-download-failed' });
    expect(mockUploadImage).not.toHaveBeenCalled();
  });
});

describe('uploadImageToAccount — Meta upload failure', () => {
  it('propagates the client GraphResult failure as-is', async () => {
    const { db } = makeFakeDb();
    mockGetAdminDb.mockResolvedValue(db);
    const { storage } = makeFakeStorage(REAL_JPEG);
    mockGetAdminStorage.mockResolvedValue(storage);
    mockUploadImage.mockResolvedValue({ ok: false, error: 'meta-down' });

    const res = await uploadImageToAccount(PROPERTY, { storagePath: 'properties/prahova-mountain-chalet/images/a.jpg' });
    expect(res).toEqual({ ok: false, error: 'meta-down' });
  });
});

describe('uploadImageToAccount — cache write failure is best-effort', () => {
  it('still returns ok:true with the imageHash even if writing the cache doc throws', async () => {
    mockGetAdminDb.mockResolvedValue({
      collection: jest.fn(() => ({
        doc: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ exists: false, data: () => undefined }),
          set: jest.fn().mockRejectedValue(new Error('firestore unavailable')),
        })),
      })),
    });
    const { storage } = makeFakeStorage(REAL_JPEG);
    mockGetAdminStorage.mockResolvedValue(storage);
    mockUploadImage.mockResolvedValue({ ok: true, data: { imageHash: 'fresh-hash-1' } });

    const res = await uploadImageToAccount(PROPERTY, { storagePath: 'properties/prahova-mountain-chalet/images/a.jpg' });
    expect(res).toEqual({ ok: true, data: { imageHash: 'fresh-hash-1' } });
  });
});
