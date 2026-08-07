/**
 * Client-side logo preparation.
 *
 * The `business-logos` bucket enforces a 1 MB per-file cap, so instead of
 * rejecting anything bigger we downscale and re-encode the image in the browser
 * until it comfortably fits. SVGs are vector text and cannot be re-encoded, so
 * they are only size-checked.
 */

export const LOGO_MAX_INPUT_BYTES = 5 * 1024 * 1024; // what a user may pick
export const LOGO_MAX_UPLOAD_BYTES = 900 * 1024; // stays under the 1 MB bucket cap

const MAX_EDGE = 1024;

export const LOGO_ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/svg+xml',
  'image/webp',
] as const;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Returns a file that is safe to upload, downscaling raster images when needed.
 * Throws a user-facing Error when the file cannot be used at all.
 */
export async function prepareLogoFile(file: File): Promise<File> {
  if (!(LOGO_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    throw new Error('Please choose a PNG, JPEG, SVG or WebP image.');
  }

  if (file.size > LOGO_MAX_INPUT_BYTES) {
    throw new Error('That image is larger than 5 MB. Please choose a smaller file.');
  }

  // Vector images cannot be re-encoded — only accept them if they already fit.
  if (file.type === 'image/svg+xml') {
    if (file.size > LOGO_MAX_UPLOAD_BYTES) {
      throw new Error('That SVG is too large. Please export a simpler version under 900 KB.');
    }
    return file;
  }

  if (file.size <= LOGO_MAX_UPLOAD_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("We couldn't read that image. Please try a different file.");
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error("We couldn't process that image. Please try a different file.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  // WebP keeps transparency and compresses well; step the quality down until it fits.
  for (const quality of [0.9, 0.8, 0.65, 0.5, 0.35]) {
    const blob = await canvasToBlob(canvas, 'image/webp', quality);
    if (blob && blob.size <= LOGO_MAX_UPLOAD_BYTES) {
      return new File([blob], 'logo.webp', { type: 'image/webp' });
    }
  }

  throw new Error('We could not compress that image enough. Please upload a smaller logo.');
}
