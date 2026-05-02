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
