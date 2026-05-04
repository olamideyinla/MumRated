"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import s from "./landing.module.css";

// Note: metadata export is ignored in client components, SEO is handled by
// the root layout default metadata which already covers the home/landing page.

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [joined, setJoined] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [isPending, startTransition] = useTransition();
  const pageRef = useRef<HTMLDivElement>(null);

  // Scroll-reveal via IntersectionObserver
  useEffect(() => {
    const els = pageRef.current?.querySelectorAll(`.${s.reveal}`) ?? [];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add(s.visible);
        });
      },
      { threshold: 0.08 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setJoinError("");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setJoinError("Please enter a valid email address.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (res.ok) {
          setJoined(true);
        } else {
          setJoinError("Something went wrong, please try again.");
        }
      } catch {
        setJoinError("Something went wrong, please try again.");
      }
    });
  }

  return (
    <div className={s.page} ref={pageRef}>

      {/* ── NAV ── */}
      <nav className={s.topnav}>
        <div className={s.navInner}>
          <Link href="/" className={s.navLogo}>
            <Image
              src="/logo-stamp.png"
              alt="MumRated!"
              width={44}
              height={44}
              style={{ mixBlendMode: "multiply", display: "block", flexShrink: 0 }}
            />
            <div>
              <div className={s.navLogoText}>MumRated!</div>
              <div className={s.navLogoSub}>Say it. Rate it. Trust it.</div>
            </div>
          </Link>

          <div className={s.navLinks}>
            <a href="#how-it-works">How it works</a>
            <a href="#categories">Categories</a>
            <a href="#for-providers">For providers</a>
            <a href="#about">About us</a>
          </div>

          <div className={s.navCtas}>
            <Link href="/home" className={`${s.btnP} ${s.navBtnOHide}`} style={{ fontSize: 13, padding: "9px 18px" }}>
              Browse
            </Link>
            <Link href="/review/new" className={s.btnP} style={{ fontSize: 13, padding: "9px 18px" }}>
              + Review
            </Link>
            <button
              className={s.navHamburger}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Open menu"
              aria-expanded={menuOpen}
            >
              <span /><span /><span />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`${s.mobileMenu}${menuOpen ? ` ${s.open}` : ""}`}>
          <a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works</a>
          <a href="#categories" onClick={() => setMenuOpen(false)}>Categories</a>
          <a href="#for-providers" onClick={() => setMenuOpen(false)}>For providers</a>
          <a href="#about" onClick={() => setMenuOpen(false)}>About us</a>
          <div className={s.mobileMenuCtas}>
            <Link href="/home" className={s.btnO} style={{ fontSize: 14 }} onClick={() => setMenuOpen(false)}>
              Browse Reviews
            </Link>
            <Link href="/review/new" className={s.btnP} style={{ fontSize: 14 }} onClick={() => setMenuOpen(false)}>
              + Write a Review
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className={s.hero}>
        <div className={s.container}>
          <div className={s.heroGrid}>
            <div className={s.reveal}>
              <div className={s.label}>Nigeria&rsquo;s #1 Mum Review Platform</div>
              <h1 className={s.heroTitle}>
                The reviews<br />mums<br /><em>actually trust.</em>
              </h1>
              <p style={{ fontSize: 16, color: "var(--mid)", lineHeight: 1.75, marginTop: 16, maxWidth: 480 }}>
                From diapers to paediatric hospitals, cr&egrave;ches to naming-ceremony photographers.
                Honest, experience-based reviews from mums who have been exactly where you are.
              </p>
              <form
                action="/search"
                method="GET"
                style={{ display: "flex", marginTop: 24, maxWidth: 460, background: "#fff", borderRadius: 30, border: "1.5px solid var(--border)", overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
              >
                <input
                  type="search"
                  name="q"
                  placeholder="Search crèches, hospitals, photographers…"
                  style={{ flex: 1, padding: "13px 18px", fontSize: 14, border: "none", outline: "none", background: "transparent", color: "var(--dark)", fontFamily: "inherit", minWidth: 0 }}
                  aria-label="Search listings"
                />
                <button
                  type="submit"
                  style={{ padding: "13px 20px", background: "var(--crimson)", color: "var(--bg)", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, fontFamily: "inherit", borderRadius: "0 28px 28px 0", flexShrink: 0 }}
                  aria-label="Search"
                >
                  Search
                </button>
              </form>

              <div className={s.heroCtas}>
                <Link href="/home" className={s.btnP} style={{ fontSize: 16, padding: "14px 32px" }}>
                  Browse Reviews
                </Link>
                <Link href="/review/new" className={s.btnO} style={{ fontSize: 16, padding: "12px 30px" }}>
                  Write a Review
                </Link>
              </div>
              <div className={s.heroStats}>
                <div>
                  <div className={s.heroStatN}>Thousands</div>
                  <div className={s.heroStatL}>of mums sharing honest reviews</div>
                </div>
              </div>
            </div>

            <div className={`${s.heroCoin} ${s.reveal}`} style={{ transitionDelay: "0.15s" }}>
              <Image
                src="/logo-stamp.png"
                alt="MumRated! stamp"
                width={300}
                height={300}
                className={s.heroCoinImg}
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── PROBLEM ── */}
      <section className={s.section} style={{ background: "var(--bgL)" }}>
        <div className={s.container}>
          <div className={`${s.problemGrid} ${s.reveal}`}>
            <div>
              <div className={s.label}>The problem</div>
              <h2 className={s.secTitle} style={{ marginBottom: 16 }}>
                Finding a cr&egrave;che shouldn&rsquo;t take 47 WhatsApp messages.
              </h2>
              <p style={{ fontSize: 15, color: "var(--mid)", lineHeight: 1.75, marginBottom: 14 }}>
                Every mum starts from zero. Every time. The same cr&egrave;che question gets asked every week
                in every group. The answers disappear into the thread.
              </p>
              <p style={{ fontSize: 15, color: "var(--mid)", lineHeight: 1.75 }}>
                MumRated! is the searchable, trusted record that mums have been building in private group chats
                for years. Now in one place, open to every mum who needs it.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className={s.problemCard} style={{ background: "#E8F0E8", borderColor: "#2A6B3A44" }}>
                <div className={s.problemCardTitle} style={{ color: "#2A6B3A" }}>WhatsApp groups</div>
                <div className={s.problemCardSub}>Trusted, but private, slow, and lost after a week.</div>
              </div>
              <div className={s.problemCard} style={{ background: "#F0E8E8", borderColor: "#8B1A1A44" }}>
                <div className={s.problemCardTitle} style={{ color: "#8B1A1A" }}>Instagram influencers</div>
                <div className={s.problemCardSub}>&ldquo;Gifted by the brand&rdquo; in tiny text. Trust is collapsing.</div>
              </div>
              <div className={s.problemCard} style={{ background: "#E8E8F0", borderColor: "#2A4B8A44" }}>
                <div className={s.problemCardTitle} style={{ color: "#2A4B8A" }}>Marketplace ratings</div>
                <div className={s.problemCardSub}>Products only. Services don&rsquo;t exist. Often empty or gamed.</div>
              </div>
              <div className={s.problemCard} style={{ background: "#FBF0E8", borderColor: "#7B181844" }}>
                <div className={s.problemCardTitle} style={{ color: "#7B1818" }}>MumRated! ✓</div>
                <div className={s.problemCardSub}>Searchable, honest, Nigeria-first, mum-led. Always.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how-it-works" className={s.section}>
        <div className={s.container}>
          <div className={s.reveal} style={{ textAlign: "center", marginBottom: 44 }}>
            <div className={s.label}>Simple by design</div>
            <h2 className={s.secTitle}>How MumRated! works</h2>
            <p style={{ fontSize: 15, color: "var(--mid)", marginTop: 10 }}>
              Three steps. No noise. Just honest mum reviews.
            </p>
          </div>
          <div className={`${s.stepsGrid} ${s.reveal}`}>
            <div className={s.stepCard} style={{ background: "#FBF0E8" }}>
              <div className={s.stepNum}>1</div>
              <div className={s.stepTitle}>Find it</div>
              <div className={s.stepBody}>Search by product, brand, service, or location. Browse by category, from baby formula to birthday decorators.</div>
            </div>
            <div className={s.stepCard} style={{ background: "#E8F3EC" }}>
              <div className={s.stepNum} style={{ background: "#2A6B3A" }}>2</div>
              <div className={s.stepTitle}>Read it</div>
              <div className={s.stepBody}>Every review is from a mum with a real experience. Ratings, tags, locations. Everything you need at a glance.</div>
            </div>
            <div className={s.stepCard} style={{ background: "#E8EDF8" }}>
              <div className={s.stepNum} style={{ background: "#2A4B8A" }}>3</div>
              <div className={s.stepTitle}>Say it</div>
              <div className={s.stepBody}>Used something? Write your review. Honest, good or bad. Your words help the next mum skip the 47 WhatsApp messages.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CATEGORIES ── */}
      <section id="categories" className={s.section} style={{ background: "var(--bgL)" }}>
        <div className={s.container}>
          <div className={s.reveal} style={{ textAlign: "center", marginBottom: 36 }}>
            <div className={s.label}>8 categories</div>
            <h2 className={s.secTitle}>Everything a mum needs</h2>
          </div>
          <div className={`${s.catsGrid} ${s.reveal}`}>
            {[
              { slug: "baby-products",       name: "Baby Products",        sub: "Formula, prams, sterilisers & more",     count: "847 reviews",  bg: "#FBF0E8", cc: "#7B1818" },
              { slug: "creches-schools",      name: "Crèches & Schools",    sub: "Nurseries, daycare, pre-schools",        count: "312 reviews",  bg: "#E8F3EC", cc: "#2A6B3A" },
              { slug: "paediatricians",       name: "Paediatricians",       sub: "Child health & specialist doctors",      count: "189 reviews",  bg: "#E8EDF8", cc: "#2A4B8A" },
              { slug: "baby-photographers",   name: "Baby Photographers",   sub: "Naming ceremonies, milestones",          count: "94 reviews",   bg: "#F5EBF5", cc: "#7A2A8A" },
              { slug: "birthday-vendors",     name: "Birthday Vendors",     sub: "Cakes, décor, entertainers",             count: "203 reviews",  bg: "#FBF5E0", cc: "#8A5A00" },
              { slug: "home-tutors",          name: "Home Tutors",          sub: "Subject tutors, lesson support",         count: "156 reviews",  bg: "#E8F5EC", cc: "#2A6B5A" },
              { slug: "party-planners",       name: "Party Planners",       sub: "Full event management",                  count: "78 reviews",   bg: "#EEEAF8", cc: "#5A3A8A" },
              { slug: "nappies-essentials",   name: "Nappies & Essentials", sub: "Wipes, lotions, feeding gear",           count: "412 reviews",  bg: "#FBF0E0", cc: "#8A4A20" },
            ].map((cat) => (
              <Link
                key={cat.slug}
                href={`/category/${cat.slug}`}
                className={s.catCard}
                style={{ background: cat.bg }}
              >
                <div className={s.catName}>{cat.name}</div>
                <div className={s.catSub}>{cat.sub}</div>
                <div className={s.catCount} style={{ color: cat.cc }}>{cat.count}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── REVIEWS ── */}
      <section className={s.section}>
        <div className={s.container}>
          <div className={s.reveal} style={{ textAlign: "center", marginBottom: 36 }}>
            <div className={s.label}>Real mums, real words</div>
            <h2 className={s.secTitle}>What mums are saying</h2>
          </div>
          <div className={`${s.reviewsGrid} ${s.reveal}`}>
            {[
              { ini: "AO", ac: "#7B1818", name: "Adaeze O.", loc: "Lagos Island", cat: "Nappies", product: "Baby Diapers (Size 3)", text: "Best diapers I have used since my first born. No leaks overnight, my son sleeps peacefully and wakes up dry. Worth every kobo.", date: "March 2025" },
              { ini: "NE", ac: "#2A4B8A", name: "Ngozi E.", loc: "Abuja", cat: "Paediatric Hospitals", product: "Lagoon Hospital, Victoria Island", text: "The paediatric ward is exceptional. Clean, organised, and the consultants actually take time to explain what is going on. My twins were admitted for three days and I never felt left in the dark.", date: "January 2025" },
              { ini: "FB", ac: "#8A5A00", name: "Funke B.", loc: "Port Harcourt", cat: "Photographers", product: "Snapshots by Tolu", text: "She captured my son\u2019s naming ceremony so beautifully I cried. Professional, patient, and delivered within a week. Book her NOW.", date: "April 2025" },
            ].map((r) => (
              <div key={r.ini} className={`${s.card} ${s.reviewCard}`}>
                <div className={s.reviewer}>
                  <div className={s.avatar} style={{ background: r.ac }}>{r.ini}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: "var(--mid)" }}>{r.loc}</div>
                  </div>
                  <div className={s.stars} style={{ marginLeft: "auto" }}>★★★★★</div>
                </div>
                <div style={{ display: "inline-block", background: "#EDD9C0", color: "#7A4A1A", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 20, marginBottom: 10 }}>
                  {r.cat}
                </div>
                <div style={{ fontFamily: "var(--font-playfair, 'Playfair Display', serif)", fontWeight: 700, fontSize: 14, color: "var(--dark)", marginBottom: 8 }}>
                  {r.product}
                </div>
                <p style={{ fontSize: 13, color: "var(--mid)", lineHeight: 1.65 }}>&ldquo;{r.text}&rdquo;</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>{r.date}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#2A6B3A", background: "#E8F3EC", borderRadius: 20, padding: "2px 8px" }}>✓ Verified Mum</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 32 }} className={s.reveal}>
            <Link href="/home" className={s.btnP} style={{ fontSize: 15, padding: "13px 36px" }}>
              See all reviews
            </Link>
          </div>
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" className={s.section} style={{ background: "var(--bgL)", padding: "80px 0" }}>
        <div className={`${s.container} ${s.reveal}`} style={{ textAlign: "center", maxWidth: 640, margin: "0 auto" }}>
          <div className={s.label}>Built by mums</div>
          <h2 className={s.secTitle} style={{ marginBottom: 20 }}>
            Built by mums. Powered by mums.
          </h2>
          <p style={{ fontSize: 16, color: "var(--mid)", lineHeight: 1.85, marginBottom: 20 }}>
            MumRated is mum-led from top to bottom. Founders, moderators, community managers, content team,
            every role filled by a mum who has lived the problem we are solving.
          </p>
          <p style={{ fontSize: 17, color: "var(--dark)", lineHeight: 1.75, fontStyle: "italic", fontFamily: "var(--font-playfair,'Playfair Display',serif)", fontWeight: 700 }}>
            We are not building this for mums. We are the mums building it.
          </p>
        </div>
      </section>

      {/* ── FOR PROVIDERS ── */}
      <section id="for-providers" className={s.providersSec}>
        <div className={s.container}>
          <div className={`${s.providersGrid} ${s.reveal}`}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "var(--gold)", textTransform: "uppercase", marginBottom: 12 }}>
                For providers
              </div>
              <h2 style={{ fontFamily: "var(--font-playfair,'Playfair Display',serif)", fontWeight: 900, fontSize: "clamp(24px,3.5vw,40px)", lineHeight: 1.15, color: "#fff", marginBottom: 16 }}>
                Your reputation,<br />in one place.
              </h2>
              <p style={{ fontSize: 15, color: "rgba(255,255,255,0.72)", lineHeight: 1.75, marginBottom: 24 }}>
                Mums are already talking about your cr&egrave;che, your practice, your photography business.
                MumRated! lets you join the conversation.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 28 }}>
                {[
                  "Free listing, mums can always find and review you",
                  "Claimed listing, respond to reviews, update your profile",
                  "Verified badge, build trust with MumRated! verification",
                ].map((feat) => (
                  <div key={feat} className={s.featureRow}>
                    <div className={s.featureCheck}>
                      <svg width="12" height="12" fill="none" stroke="#fff" strokeWidth="2.5" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>
                    {feat}
                  </div>
                ))}
              </div>
              <Link href="/providers" style={{ display: "inline-block", background: "var(--gold)", color: "var(--dark)", padding: "14px 32px", borderRadius: 30, fontWeight: 700, fontSize: 15 }}>
                Claim Your Listing
              </Link>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { icon: "🏫", type: "Crèche / School", text: "Be found by mums searching for nurseries near them." },
                { icon: "👩‍⚕️", type: "Paediatrician", text: "Build trust before a mum even walks through your door." },
                { icon: "📸", type: "Baby Photographer", text: "Your next naming ceremony client is on MumRated! right now." },
                { icon: "🎂", type: "Birthday Vendor", text: "Word of mouth, searchable and permanent." },
              ].map((p) => (
                <div key={p.type} className={s.providerCard}>
                  <div className={s.providerIcon}>{p.icon}</div>
                  <div>
                    <div className={s.providerType}>{p.type}</div>
                    <div className={s.providerText}>{p.text}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA / SIGN UP ── */}
      <section className={s.ctaSec}>
        <div className={`${s.container} ${s.reveal}`} style={{ maxWidth: 580, margin: "0 auto", textAlign: "center" }}>
          <Image
            src="/logo-stamp.png"
            alt=""
            width={90}
            height={90}
            style={{ mixBlendMode: "multiply", marginBottom: 20, filter: "brightness(1.5)" }}
            aria-hidden
          />
          <h2 style={{ fontFamily: "var(--font-playfair,'Playfair Display',serif)", fontWeight: 900, fontSize: "clamp(24px,4vw,40px)", color: "#fff", lineHeight: 1.15, marginBottom: 14 }}>
            Be part of the movement.
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", marginBottom: 28, lineHeight: 1.7 }}>
            Join thousands of mums who are already saying it, rating it, and trusting it.
          </p>
          {joined ? (
            <p style={{ color: "#fff", fontSize: 15, fontWeight: 600, marginBottom: 16 }}>
              You&rsquo;re in! Check your inbox for a welcome email. ✓
            </p>
          ) : (
            <>
              <form onSubmit={handleJoin} className={s.emailRow}>
                <input
                  type="email"
                  placeholder="Your email address"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (joinError) setJoinError(""); }}
                  aria-label="Email address"
                  disabled={isPending}
                />
                <button type="submit" disabled={isPending}>
                  {isPending ? "Joining…" : "Get started →"}
                </button>
              </form>
              {joinError && (
                <p style={{ color: "rgba(255,200,200,0.9)", fontSize: 13, marginTop: 8 }}>
                  {joinError}
                </p>
              )}
            </>
          )}
          <Link href="/home" style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, textDecoration: "underline" }}>
            Or browse reviews now →
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className={s.footerWrapper}>
        <div className={s.container}>
          <div className={s.footerGrid}>
            <div>
              <div style={{ fontFamily: "var(--font-playfair,'Playfair Display',serif)", fontWeight: 900, fontSize: 20, color: "#fff", marginBottom: 4 }}>
                MumRated!
              </div>
              <div style={{ fontSize: 12, fontStyle: "italic", color: "var(--gold)" }}>Say it. Rate it. Trust it.</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>MumRated.com · Nigeria-first</div>
            </div>
            <div className={s.footerLinks}>
              <div className={s.footerCol}>
                <div className={s.footerColTitle}>Platform</div>
                <Link href="/home">Browse Reviews</Link>
                <Link href="/review/new">Write a Review</Link>
                <Link href="/browse">Categories</Link>
                <Link href="/search">Search</Link>
              </div>
              <div className={s.footerCol}>
                <div className={s.footerColTitle}>Company</div>
                <Link href="/about">Who we are</Link>
                <Link href="/how-it-works">How it works</Link>
                <Link href="/trust">Trust &amp; Transparency</Link>
                <a href="mailto:hello@mumrated.com">Contact</a>
              </div>
              <div className={s.footerCol}>
                <div className={s.footerColTitle}>Providers</div>
                <Link href="/providers">Claim listing</Link>
                <Link href="/how-it-works">How it works</Link>
              </div>
            </div>
          </div>
          <div className={s.footerBottom}>
            <div>&copy; {new Date().getFullYear()} MumRated! &middot; All rights reserved</div>
            <div className={s.footerLegal}>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms of Use</Link>
              <Link href="/trust">Community Guidelines</Link>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
