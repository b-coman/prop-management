/**
 * Per-account image upload + dedup cache — Phase 2a Build A (plan REVISIONS
 * B4; contract verified live-PAUSED against the account, docs/meta-ads-
 * infrastructure-2026.md §9d/§10).
 *
 * `uploadImageToAccount` is the ONLY caller of `client.ts`'s `uploadImage`
 * helper. It owns three responsibilities the low-level upload call doesn't:
 *
 *  1. **Per-(platform, ad account, content hash) cache** in Firestore
 *     `adImageCache` — `image_hash` is (very likely) ACCOUNT-SCOPED (§10), so
 *     the cache key includes the ad account id (with any `act_` prefix
 *     normalized off), not just the image bytes. A cache hit skips BOTH the
 *     Storage read and the Meta upload entirely.
 *  2. **The size/width guard** (§10: max 30MB, min width 600px) — applied to
 *     the ACTUAL downloaded bytes, before any upload attempt. Meta's own
 *     limits exist regardless of what we check, but failing closed here means
 *     a bad asset never reaches a live API call.
 *  3. **Computing the real `contentHash`** (sha256 of the downloaded bytes).
 *     A caller (adComposer) may pass a `contentHash` it already knows, and
 *     that is used as a FAST pre-download cache probe — but it is never
 *     trusted as the record of truth: after downloading, this module always
 *     recomputes sha256 from the actual bytes and uses THAT for the final
 *     cache write (and a second cache probe, in case the caller's hash was
 *     stale/wrong but the real bytes were already cached under the correct
 *     one). This mirrors the "never trust a caller-supplied identity for a
 *     security/dedup-relevant decision" discipline used throughout this
 *     module tree (e.g. `adExecutionGateway`'s ownership assert).
 *
 * Never throws (`GraphResult` discipline, same as the rest of `metaAds/*`) —
 * a Storage hiccup, a malformed image, or a Firestore cache-write failure
 * must never crash `adComposer`'s critical path. A cache-write failure after
 * a SUCCESSFUL Meta upload is logged and swallowed (best-effort) rather than
 * turned into a failure — the image already exists in the ad account; losing
 * the cache entry only costs a redundant future upload, never correctness.
 *
 * Plain server module (NOT `'use server'`) — exports types + async functions.
 */
import { createHash } from 'crypto';
import { getAdminDb, getAdminStorage, FieldValue } from '@/lib/firebaseAdminSafe';
import { loggers } from '@/lib/logger';
import { resolveAdContext } from './adContext';
import { uploadImage, type GraphResult } from './client';

const logger = loggers.ads;

const PLATFORM = 'meta' as const;

/** Max upload size — 30MB (docs/meta-ads-infrastructure-2026.md §10). Checked against the RAW bytes, before any base64 inflation (we don't base64 — multipart — but the byte-count ceiling is the same limit). */
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;

/** Min accepted width in px (§10). Applied to whatever width we can determine from the file's own header — an image we can't parse is rejected rather than assumed valid. */
const MIN_IMAGE_WIDTH_PX = 600;

export interface UploadImageInput {
  /** Full Firebase Storage path — NEVER a thumbnail (plan REVISIONS B4). */
  storagePath: string;
  /**
   * Optional caller-known sha256 of the same bytes — used ONLY as a fast
   * pre-download cache probe. The authoritative hash is always recomputed
   * from the downloaded bytes (see module doc comment).
   */
  contentHash?: string;
}

/** Meta returns `account_id` without the `act_` prefix; our config carries it with. Normalize both to the same bare form for the cache key (mirrors `adExecutionGateway`'s `normalizeAccountId`). */
function normalizeAccountId(id: string): string {
  return id.startsWith('act_') ? id.slice(4) : id;
}

function cacheDocId(accountId: string, contentHash: string): string {
  return `${PLATFORM}_${normalizeAccountId(accountId)}_${contentHash}`;
}

type AdminDb = Awaited<ReturnType<typeof getAdminDb>>;

async function readCachedImageHash(
  db: AdminDb,
  accountId: string,
  contentHash: string
): Promise<string | undefined> {
  try {
    const snap = await db.collection('adImageCache').doc(cacheDocId(accountId, contentHash)).get();
    if (!snap.exists) return undefined;
    const imageHash = (snap.data() as { imageHash?: string } | undefined)?.imageHash;
    return imageHash || undefined;
  } catch (error) {
    // Fail OPEN to "cache miss" (not to an error) — a cache read failure must
    // never block the upload path; worst case we re-upload an already-cached
    // image, which is wasteful but not incorrect.
    logger.warn('uploadImageToAccount: cache read failed — treating as a miss', { error: String(error) });
    return undefined;
  }
}

async function writeCachedImageHash(
  db: AdminDb,
  accountId: string,
  contentHash: string,
  imageHash: string,
  propertyId: string
): Promise<void> {
  try {
    await db
      .collection('adImageCache')
      .doc(cacheDocId(accountId, contentHash))
      .set({
        platform: PLATFORM,
        accountId: normalizeAccountId(accountId),
        contentHash,
        imageHash,
        uploadedAt: FieldValue.serverTimestamp(),
      });
  } catch (error) {
    // Best-effort — the Meta upload already succeeded; losing the cache write
    // only costs a redundant future upload, never correctness (see module doc).
    logger.warn('uploadImageToAccount: cache write failed (upload already succeeded, continuing)', {
      propertyId,
      error: String(error),
    });
  }
}

// ---------------------------------------------------------------------------
// Minimal image-width readers — JPEG/PNG only (the two formats Meta accepts,
// §10). Deliberately NOT a full decoder/dependency: we only need the pixel
// width out of the header to enforce the 600px floor before ever uploading.
// ---------------------------------------------------------------------------

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPngWidth(bytes: Buffer): number | undefined {
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) return undefined;
  // IHDR is always the first chunk: [len(4)][type(4)="IHDR"][width(4)][height(4)]...
  if (bytes.toString('ascii', 12, 16) !== 'IHDR') return undefined;
  return bytes.readUInt32BE(16);
}

// SOFn (Start Of Frame) markers that carry width/height — excludes 0xC4 (DHT),
// 0xC8 (JPG extension, unused), 0xCC (DAC) which are numerically in-range but
// are NOT frame markers.
const JPEG_SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function readJpegWidth(bytes: Buffer): number | undefined {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined; // SOI

  let offset = 2;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1; // resync — not a marker boundary
      continue;
    }
    const marker = bytes[offset + 1];
    // Markers with no length/payload: SOI, standalone (TEM/RSTn).
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9) return undefined; // EOI — reached the end without a SOF
    if (offset + 3 >= bytes.length) return undefined;

    const segmentLength = bytes.readUInt16BE(offset + 2); // includes the 2 length bytes themselves
    if (JPEG_SOF_MARKERS.has(marker)) {
      if (offset + 8 >= bytes.length) return undefined;
      // [FF][marker][len:2][precision:1][height:2][width:2]...
      return bytes.readUInt16BE(offset + 7);
    }
    offset += 2 + segmentLength;
  }
  return undefined;
}

/** Best-effort pixel width from a JPEG or PNG header. Returns undefined for anything else or a malformed/truncated file — treated as "can't verify, reject" by the caller. */
export function getImageWidthPx(bytes: Buffer): number | undefined {
  return readPngWidth(bytes) ?? readJpegWidth(bytes);
}

function contentTypeForPath(storagePath: string): string {
  return storagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
}

/**
 * Resolve (upload-or-reuse) a Meta `image_hash` for a gallery image, scoped to
 * the property's ad account. Never throws. See module doc comment for the
 * cache-then-download-then-verify sequencing.
 */
export async function uploadImageToAccount(
  propertyId: string,
  image: UploadImageInput
): Promise<GraphResult<{ imageHash: string }>> {
  try {
    const ctx = await resolveAdContext(propertyId);
    if (!ctx) {
      logger.warn('uploadImageToAccount: no ad context for property — refusing to upload', { propertyId });
      return { ok: false, error: 'no-ad-context' };
    }

    const db = await getAdminDb();

    // Fast path: a caller-supplied hash lets us skip the Storage download
    // entirely on a hit (plan: "cache-check FIRST ... BEFORE uploading").
    if (image.contentHash) {
      const cached = await readCachedImageHash(db, ctx.adAccountId, image.contentHash);
      if (cached) {
        logger.info('uploadImageToAccount: cache hit (pre-download)', { propertyId, storagePath: image.storagePath });
        return { ok: true, data: { imageHash: cached } };
      }
    }

    // Miss (or no hash given up front) — every downstream decision (the real
    // cache key, the size/width guard) is derived from the ACTUAL bytes, never
    // from an unverified caller-supplied hash.
    let bytes: Buffer;
    try {
      const storage = await getAdminStorage();
      const [downloaded] = await storage.bucket().file(image.storagePath).download();
      bytes = downloaded;
    } catch (error) {
      logger.warn('uploadImageToAccount: Storage download failed', {
        propertyId,
        storagePath: image.storagePath,
        error: String(error),
      });
      return { ok: false, error: 'storage-download-failed' };
    }

    if (bytes.length > MAX_IMAGE_BYTES) {
      logger.warn('uploadImageToAccount: image exceeds 30MB — refusing to upload', {
        propertyId,
        storagePath: image.storagePath,
        bytes: bytes.length,
      });
      return { ok: false, error: 'image-too-large' };
    }

    const width = getImageWidthPx(bytes);
    if (!width || width < MIN_IMAGE_WIDTH_PX) {
      logger.warn('uploadImageToAccount: image narrower than 600px (or width undeterminable) — refusing to upload', {
        propertyId,
        storagePath: image.storagePath,
        width,
      });
      return { ok: false, error: 'image-too-narrow' };
    }

    const contentHash = createHash('sha256').update(bytes).digest('hex');

    // Re-check the cache under the VERIFIED hash — catches the case where the
    // caller's hash (checked above, if any) was stale/wrong but these exact
    // bytes are already cached under their real hash.
    const verifiedHit = await readCachedImageHash(db, ctx.adAccountId, contentHash);
    if (verifiedHit) {
      logger.info('uploadImageToAccount: cache hit (post-download, verified hash)', {
        propertyId,
        storagePath: image.storagePath,
      });
      return { ok: true, data: { imageHash: verifiedHit } };
    }

    const filename = image.storagePath.split('/').pop() || 'image.jpg';
    const uploaded = await uploadImage(
      ctx.adAccountId,
      ctx.token,
      { bytes, filename, contentType: contentTypeForPath(image.storagePath) },
      propertyId
    );
    if (!uploaded.ok) {
      logger.warn('uploadImageToAccount: Meta upload failed', {
        propertyId,
        storagePath: image.storagePath,
        error: uploaded.error,
      });
      return uploaded;
    }

    await writeCachedImageHash(db, ctx.adAccountId, contentHash, uploaded.data.imageHash, propertyId);

    logger.info('uploadImageToAccount: uploaded and cached', {
      propertyId,
      storagePath: image.storagePath,
      imageHash: uploaded.data.imageHash,
    });
    return { ok: true, data: { imageHash: uploaded.data.imageHash } };
  } catch (error) {
    // Safety net — every expected failure above already returns cleanly; this
    // only catches something genuinely unexpected (never throw, plan-wide rule).
    logger.warn('uploadImageToAccount: unexpected error', { propertyId, error: String(error) });
    return { ok: false, error: `unexpected:${String(error)}` };
  }
}
