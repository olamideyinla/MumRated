import type { Metadata, Viewport } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import "./globals.css";

// ── Google Fonts ──────────────────────────────────────────────────────────
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-dm-sans",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

// ── Site Metadata ─────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: {
    default: "MumRated! — Say it. Rate it. Trust it.",
    template: "%s | MumRated!",
  },
  description:
    "Nigeria's #1 mum review platform. Honest, experience-based reviews on products and services — from nappies to crèches, paediatricians to baby photographers.",
  keywords: [
    "Nigerian mums",
    "baby products reviews",
    "crèche reviews Nigeria",
    "paediatrician reviews Lagos",
    "mum community Nigeria",
  ],
  authors: [{ name: "MumRated!" }],
  creator: "MumRated!",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://mumrated.com"
  ),
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: "https://mumrated.com",
    siteName: "MumRated!",
    title: "MumRated! — Say it. Rate it. Trust it.",
    description:
      "Honest reviews from Nigerian mums. Products, crèches, paediatricians, photographers and more.",
  },
  twitter: {
    card: "summary_large_image",
    title: "MumRated!",
    description: "The reviews Nigerian mums actually trust.",
    creator: "@mumrated",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#7B1818",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

// ── Root Layout ───────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${dmSans.variable} ${playfair.variable}`}>
      <body className="font-body">{children}</body>
    </html>
  );
}
