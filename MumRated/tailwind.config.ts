import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ── Brand Colors (from design README) ───────────────────────────────
      colors: {
        crimson: {
          DEFAULT: "#7B1818", // primary brand / CTA buttons / active states
          dark: "#5E1010",    // hover state
          light: "#A02020",   // light variant
        },
        gold: {
          DEFAULT: "#C9A227", // stars / accents / gold CTA
          light: "#E8C84A",
        },
        bg: {
          DEFAULT: "#F5EDE0",  // page background (warm cream)
          light: "#FBF6EE",    // card backgrounds / nav / sidebar
        },
        card: "#FFFFFF",
        dark: "#3B2010",        // primary text (dark brown)
        mid: "#7A5040",         // secondary text
        muted: "#A07860",       // tertiary / placeholder text
        border: "#E0CEB8",      // borders / dividers
        tag: {
          DEFAULT: "#EDD9C0",   // category tag background
          text: "#7A4A1A",      // category tag text
        },
        verified: "#2A6B3A",    // verified badge / success states

        // ── Category accent colors (used in cards / counts) ──────────────
        cat: {
          "baby-products":    "#7B1818",
          creches:            "#2A6B3A",
          paediatricians:     "#2A4B8A",
          photographers:      "#7A2A8A",
          birthday:           "#8A5A00",
          tutors:             "#2A6B5A",
          party:              "#5A3A8A",
          nappies:            "#8A4A20",
        },

        // ── Category card backgrounds ────────────────────────────────────
        catbg: {
          "baby-products":    "#FBF0E8",
          creches:            "#E8F3EC",
          paediatricians:     "#E8EDF8",
          photographers:      "#F5EBF5",
          birthday:           "#FBF5E0",
          tutors:             "#E8F5EC",
          party:              "#EEEAF8",
          nappies:            "#FBF0E0",
        },

        // ── Problem section card colors ──────────────────────────────────
        problem: {
          whatsapp:    "#2A6B3A",
          instagram:   "#8B1A1A",
          jumia:       "#2A4B8A",
          mumrated:    "#7B1818",
        },
      },

      // ── Typography ───────────────────────────────────────────────────────
      fontFamily: {
        display: ["var(--font-playfair)", "Georgia", "serif"],
        body: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Design system type scale
        "2xs":  ["9px",  { lineHeight: "1.4" }],   // logo subline
        xs:     ["11px", { lineHeight: "1.5" }],   // label / caption / small
        sm:     ["12px", { lineHeight: "1.5" }],   // secondary small
        base:   ["13px", { lineHeight: "1.65" }],  // review body / tags
        md:     ["14px", { lineHeight: "1.65" }],  // body / product name
        lg:     ["15px", { lineHeight: "1.75" }],  // body paragraphs
        xl:     ["16px", { lineHeight: "1.75" }],  // hero body / CTA
        "2xl":  ["17px", { lineHeight: "1.4" }],   // nav wordmark / topbar title
        "3xl":  ["20px", { lineHeight: "1.3" }],   // step title / card title
        "4xl":  ["22px", { lineHeight: "1.2" }],   // section sub-heading
        "5xl":  ["24px", { lineHeight: "1.2" }],   // section title (min)
        "6xl":  ["28px", { lineHeight: "1.15" }],  // app home H1 / onboarding
        "7xl":  ["30px", { lineHeight: "1" }],     // hero stat numbers
        "8xl":  ["36px", { lineHeight: "1" }],     // about stat numbers
        "9xl":  ["40px", { lineHeight: "1.1" }],   // item rating number
        hero:   ["clamp(34px,6vw,58px)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "sec":  ["clamp(24px,4vw,40px)", { lineHeight: "1.2" }],
      },
      fontWeight: {
        normal: "400",
        medium: "500",
        semibold: "600",
        bold: "700",
        extrabold: "800",
        black: "900",
      },
      letterSpacing: {
        label:  "0.1em",   // section labels (UPPERCASE)
        wide:   "0.08em",  // footer col titles / trust bar
        tight:  "-0.02em", // hero title
      },

      // ── Spacing Scale (from design README, in px) ────────────────────────
      spacing: {
        px:   "1px",
        0.5:  "2px",
        1:    "4px",    // tight gaps (icon+label, star gaps)
        1.5:  "6px",    // xs
        2:    "8px",    // sm
        2.5:  "10px",   // sm+
        3:    "12px",   // md-
        3.5:  "14px",   // md
        4:    "16px",   // md+ (standard padding)
        5:    "20px",   // lg (container horizontal padding)
        6:    "24px",   // xl (hero gap)
        7:    "28px",   // xl+
        8:    "32px",   // 2xl
        10:   "40px",   // 3xl
        12:   "48px",   // 4xl
        14:   "56px",   // providers gap
        16:   "64px",   // section vertical padding
        18:   "72px",   // section vertical padding (desktop)
        22:   "88px",   // search result image
        screen: "100vh",
      },

      // ── Border Radius ────────────────────────────────────────────────────
      borderRadius: {
        none:   "0",
        tag:    "6px",   // small tags / chips
        img:    "10px",  // image thumbnails
        input:  "12px",  // inputs / textareas
        card:   "14px",  // standard cards
        "card-lg": "16px", // large cards
        pill:   "30px",  // pill buttons (all CTAs)
        nav:    "20px",  // nav link pills
        step:   "50%",   // step numbers / avatars
        phone:  "52px",  // phone frame outer
        full:   "9999px",
      },

      // ── Box Shadow ───────────────────────────────────────────────────────
      boxShadow: {
        card:         "0 2px 8px rgba(0,0,0,0.06)",
        "card-hover": "0 6px 20px rgba(0,0,0,0.10)",
        "card-sm":    "0 1px 5px rgba(0,0,0,0.06)",
        "btn-crimson":"0 4px 14px rgba(123,24,24,0.267)",
        "btn-lg":     "0 6px 20px rgba(123,24,24,0.333)",
      },

      // ── Breakpoints ──────────────────────────────────────────────────────
      screens: {
        // Design system breakpoints (mobile-first, override Tailwind defaults)
        sm:  "600px",   // mobile → content reduces padding, single col
        md:  "860px",   // tablet → hero stacks, nav hamburger
        lg:  "1100px",  // container max-width / desktop layouts
        xl:  "1280px",
        "2xl": "1536px",
      },

      // ── Max Width ────────────────────────────────────────────────────────
      maxWidth: {
        container: "1100px",
        hero:      "480px",  // hero body copy
        cta:       "580px",  // CTA section
        info:      "680px",  // info pages (about/faq/contact)
        about:     "720px",  // about section
        email:     "440px",  // email signup row
        sidebar:   "230px",  // desktop sidebar
      },

      // ── Keyframes & Animations ───────────────────────────────────────────
      keyframes: {
        slideUp: {
          "0%":   { transform: "translateY(18px)", opacity: "0" },
          "100%": { transform: "translateY(0)",    opacity: "1" },
        },
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        popIn: {
          "0%":   { transform: "scale(0.7)",  opacity: "0" },
          "80%":  { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)",    opacity: "1" },
        },
        floatY: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-12px)" },
        },
        reveal: {
          "0%":   { opacity: "0", transform: "translateY(22px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "slide-up":   "slideUp 0.3s cubic-bezier(0.34,1.2,0.64,1) both",
        "fade-in":    "fadeIn 0.22s ease both",
        "pop-in":     "popIn 0.5s cubic-bezier(0.34,1.4,0.64,1) both",
        "float-y":    "floatY 4s ease-in-out infinite",
        "scroll-reveal": "reveal 0.6s ease both",
      },

      // ── Background Gradients ─────────────────────────────────────────────
      backgroundImage: {
        "hero-gradient":  "linear-gradient(160deg, #FBF6EE 0%, #F5EDE0 100%)",
        "cta-gradient":   "linear-gradient(135deg, #5E1010, #7B1818)",
        "nav-blur":       "linear-gradient(to bottom, rgba(253,250,244,0.96), rgba(253,250,244,0.96))",
      },
    },
  },
  plugins: [],
};

export default config;
