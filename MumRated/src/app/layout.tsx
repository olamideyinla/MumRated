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
    "Honest reviews from Nigerian mums. Best baby products, crèches, paediatricians, and family services in Nigeria — rated by mums who've used them.",
  keywords: [
    "best baby products Nigeria",
    "crèche reviews Nigeria",
    "paediatrician reviews Lagos",
    "mum reviews Nigeria",
    "baby products Nigeria",
    "best crèche Lagos",
    "nappies review Nigeria",
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
    images: [{ url: "/logo-stamp.png", width: 512, height: 512, alt: "MumRated! logo" }],
  },
  twitter: {
    card: "summary",
    title: "MumRated!",
    description: "The reviews Nigerian mums actually trust.",
    creator: "@mumrated",
    images: ["/logo-stamp.png"],
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
  // maximumScale removed — capping scale to 1 is a WCAG 1.4.4 (Resize Text)
  // failure. Users who need to zoom for accessibility must be allowed to do so.
};

// ── Root Layout ───────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-NG" className={`${dmSans.variable} ${playfair.variable}`}>
      <body className="font-body">
        {/* Skip-to-content — first focusable element on the page.
            Hidden visually until focused; essential for keyboard/screen-reader users. */}
        {/* Preconnect to Cloudinary CDN for faster image loads */}
        {/* eslint-disable-next-line @next/next/no-head-element */}
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:rounded-lg focus:bg-crimson focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
