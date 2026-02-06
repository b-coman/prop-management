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

export interface UploadResult {
  fullUrl: string;
  thumbnailUrl: string;
  storagePath: string;
  thumbnailStoragePath: string;
}

export async function uploadPropertyImage(
  slug: string,
  fullBlob: Blob,
  thumbBlob: Blob,
  extension: string,
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  const id = crypto.randomUUID();
  const storagePath = `properties/${slug}/images/${id}.${extension}`;
  const thumbnailStoragePath = `properties/${slug}/images/${id}_thumb.${extension}`;

  // Upload full image with progress tracking
  const fullRef = ref(storage, storagePath);
  const fullTask = uploadBytesResumable(fullRef, fullBlob, {
    contentType: fullBlob.type,
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

  // Upload thumbnail (no progress tracking — it's small)
  const thumbRef = ref(storage, thumbnailStoragePath);
  await uploadBytesResumable(thumbRef, thumbBlob, {
    contentType: thumbBlob.type,
  });

  if (onProgress) onProgress(100);

  const [fullUrl, thumbnailUrl] = await Promise.all([
    getDownloadURL(fullRef),
    getDownloadURL(thumbRef),
  ]);

  return { fullUrl, thumbnailUrl, storagePath, thumbnailStoragePath };
}

export async function deleteStorageImage(
  storagePath: string,
  thumbnailPath?: string
): Promise<void> {
  const fullRef = ref(storage, storagePath);
  await deleteObject(fullRef);

  if (thumbnailPath) {
    const thumbRef = ref(storage, thumbnailPath);
    try {
      await deleteObject(thumbRef);
    } catch {
      // Thumbnail may not exist — ignore
    }
  }
}
