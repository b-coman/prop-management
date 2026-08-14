/**
 * Firebase Storage upload/delete wrapper for property images.
 * Uses client SDK with uploadBytesResumable for progress tracking.
 */

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from './firebase-storage';

/**
 * Long-lived cache header for property images.
 *
 * Storage returns `private, max-age=0` when no cacheControl is set, which both
 * forces a re-download on every pageview and blocks CDN caching outright. Every
 * object here is named by a fresh crypto.randomUUID(), so a replaced photo gets
 * a new URL and `immutable` is safe. Never overwrite an object in place.
 */
export const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export interface UploadResult {
  fullUrl: string;
  displayUrl: string;
  thumbnailUrl: string;
  storagePath: string;
  displayStoragePath: string;
  thumbnailStoragePath: string;
}

export async function uploadPropertyImage(
  slug: string,
  fullBlob: Blob,
  displayBlob: Blob,
  thumbBlob: Blob,
  extension: string,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  const id = crypto.randomUUID();
  const storagePath = `properties/${slug}/images/${id}.${extension}`;
  const displayStoragePath = `properties/${slug}/images/${id}_display.${extension}`;
  const thumbnailStoragePath = `properties/${slug}/images/${id}_thumb.${extension}`;

  // Upload full image with progress tracking
  const fullRef = ref(storage, storagePath);
  const fullTask = uploadBytesResumable(fullRef, fullBlob, {
    contentType: fullBlob.type,
    cacheControl: IMAGE_CACHE_CONTROL,
  });

  await new Promise<void>((resolve, reject) => {
    fullTask.on(
      'state_changed',
      (snapshot) => {
        if (onProgress) {
          const percent = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 90
          );
          onProgress(percent);
        }
      },
      reject,
      () => resolve()
    );
  });

  // Upload display + thumbnail (no progress tracking, they're small)
  const displayRef = ref(storage, displayStoragePath);
  const thumbRef = ref(storage, thumbnailStoragePath);
  await Promise.all([
    uploadBytesResumable(displayRef, displayBlob, {
      contentType: displayBlob.type,
      cacheControl: IMAGE_CACHE_CONTROL,
    }),
    uploadBytesResumable(thumbRef, thumbBlob, {
      contentType: thumbBlob.type,
      cacheControl: IMAGE_CACHE_CONTROL,
    }),
  ]);

  if (onProgress) onProgress(100);

  const [fullUrl, displayUrl, thumbnailUrl] = await Promise.all([
    getDownloadURL(fullRef),
    getDownloadURL(displayRef),
    getDownloadURL(thumbRef),
  ]);

  return { fullUrl, displayUrl, thumbnailUrl, storagePath, displayStoragePath, thumbnailStoragePath };
}

export async function deleteStorageImage(
  storagePath: string,
  thumbnailPath?: string,
  displayPath?: string
): Promise<void> {
  const fullRef = ref(storage, storagePath);
  await deleteObject(fullRef);

  // Derivatives may not exist on older images, so failures are ignored.
  for (const path of [thumbnailPath, displayPath]) {
    if (!path) continue;
    try {
      await deleteObject(ref(storage, path));
    } catch {
      // Derivative missing, nothing to clean up
    }
  }
}
