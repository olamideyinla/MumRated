import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to upload photos." }, { status: 401 });
  }

  const { dataUri } = (await req.json()) as { dataUri?: string };
  if (!dataUri || !dataUri.startsWith("data:image/")) {
    return NextResponse.json({ error: "Invalid image data." }, { status: 400 });
  }

  // Aggressively compress: max 1200px, auto quality, WebP delivery, strip EXIF
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: "mumrated/reviews",
    resource_type: "image",
    transformation: [
      { width: 1200, height: 1200, crop: "limit" },
      { quality: "auto:low", fetch_format: "auto" },
      { strip_profile: true },
    ],
  });

  return NextResponse.json({ url: result.secure_url });
}
