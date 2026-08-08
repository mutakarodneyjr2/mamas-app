import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Compresses an image file using HTML5 Canvas to prevent web worker deadlocks or memory issues.
 * Returns both a compressed Blob and a compressed JPEG data URL for fallback.
 */
export const compressImage = async (
  file: File,
  maxDimension = 1000,
  quality = 0.75
): Promise<{ blob: Blob; dataUrl: string }> => {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image.'));
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get 2D canvas context.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, dataUrl });
            } else {
              reject(new Error('Canvas compression failed to produce blob.'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Failed to load image for processing.'));
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
  });
};

export interface UploadOptions {
  timeoutMs?: number;
  allowDataUrlFallback?: boolean;
  maxDimension?: number;
  quality?: number;
}

/**
 * Uploads an image to Firebase Storage with strict timeout and data URL fallback.
 * Guarantees resolution within timeoutMs and never leaves caller hanging indefinitely.
 */
export const uploadImage = async (
  file: File,
  path: string,
  options: UploadOptions = {}
): Promise<string> => {
  const {
    timeoutMs = 10000,
    allowDataUrlFallback = true,
    maxDimension = 1000,
    quality = 0.75,
  } = options;

  let compressedDataUrl = '';

  try {
    const { blob, dataUrl } = await compressImage(file, maxDimension, quality);
    compressedDataUrl = dataUrl;

    const storageRef = ref(storage, path);

    // Upload with timeout race
    const uploadPromise = (async () => {
      const snapshot = await uploadBytes(storageRef, blob, {
        contentType: 'image/jpeg',
      });
      return await getDownloadURL(snapshot.ref);
    })();

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Storage upload timed out after ${timeoutMs / 1000}s`));
      }, timeoutMs);
    });

    const downloadURL = await Promise.race([uploadPromise, timeoutPromise]);
    return downloadURL;
  } catch (error: any) {
    console.warn(`Firebase Storage upload failed for path "${path}":`, error?.message || error);

    if (allowDataUrlFallback && compressedDataUrl) {
      console.info('Falling back to compressed data URL for image.');
      return compressedDataUrl;
    }

    throw new Error(
      error?.message || 'Failed to upload image. Please check your network connection.'
    );
  }
};

export const deleteImage = async (path: string): Promise<void> => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.warn('Error deleting image path:', path, error);
  }
};
