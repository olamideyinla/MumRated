import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload a file Buffer/base64 string to Cloudinary.
 * Returns the secure URL of the uploaded image.
 */
export async function uploadProfilePhoto(
  source: string, // base64 data-URI or URL
  userId: string,
): Promise<string> {
  const result = await cloudinary.uploader.upload(source, {
    folder: "mumrated/profiles",
    public_id: userId,
    overwrite: true,
    resource_type: "image",
    transformation: [
      { width: 400, height: 400, crop: "fill", gravity: "face" },
      { quality: "auto", fetch_format: "auto" },
    ],
  });
  return result.secure_url;
}

export { cloudinary };

// ── URL transformation helpers ────────────────────────────────────────────
//
// next/image handles AVIF/WebP negotiation for all <Image> components.
// These helpers cover the remaining cases:
//   - OG / social preview images (fixed 1200×630 crop for WhatsApp/FB/X)
//   - Raw <img> tags that can't use <Image> (e.g. home-page review stream)
//
// Cloudinary shape:
//   https://res.cloudinary.com/{cloud}/{type}/upload/{transforms}/{public_id}

const CLD_UPLOAD = /^(https:\/\/res\.cloudinary\.com\/[^/]+\/[^/]+\/upload\/)/;

function injectTransform(url: string, transforms: string): string {
  // Remove any existing f_auto / q_auto to avoid duplicates
  const cleaned = url
    .replace(/\bf_auto\b,?/g, "")
    .replace(/\bq_auto(?::[a-z]+)?\b,?/g, "")
    .replace(/\/,/g, "/"); // clean up dangling commas
  return cleaned.replace(CLD_UPLOAD, `$1${transforms}/`);
}

/**
 * Returns an AVIF/WebP-optimised URL for <img> tags or CSS backgrounds.
 * Passes non-Cloudinary URLs through unchanged.
 */
export function cldOptimise(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!CLD_UPLOAD.test(url)) return url;
  return injectTransform(url, "f_auto,q_auto");
}

/**
 * Returns a 1200×630 JPEG crop for OG / social preview images.
 * WhatsApp, Facebook, and X all expect a 1.91:1 ratio at ≥600 px wide.
 */
export function cldOgImage(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!CLD_UPLOAD.test(url)) return url;
  return injectTransform(url, "f_jpg,q_auto:good,w_1200,h_630,c_fill");
}

/**
 * Returns a width-constrained WebP thumbnail.
 * Use for listing cards where the display size is known.
 */
export function cldThumb(
  url: string | null | undefined,
  width: number,
): string | null {
  if (!url) return null;
  if (!CLD_UPLOAD.test(url)) return url;
  return injectTransform(url, `f_auto,q_auto,w_${width},c_limit`);
}
