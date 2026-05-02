"use client";

import { signIn } from "next-auth/react";
import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function SignInForm() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/";
  const errorCode = params.get("error");

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [isPending, startTransition] = useTransition();

  const errorMessages: Record<string, string> = {
    OAuthAccountNotLinked:
      "That email is already linked to a different sign-in method. Try Google — or send yourself a magic link.",
    OAuthCallbackError:
      "Google didn't play ball this time. Give it another go.",
    Default: "Something went sideways. Try again and it should clear up.",
  };

  const errorMessage = errorCode
    ? (errorMessages[errorCode] ?? errorMessages.Default)
    : null;

  function handleGoogleSignIn() {
    startTransition(() => {
      signIn("google", { callbackUrl });
    });
  }

  function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setEmailError("Pop your email in here first.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("That doesn't look quite right — double-check the email address.");
      return;
    }
    setEmailError("");
    startTransition(async () => {
      const res = await signIn("resend", {
        email,
        callbackUrl,
        redirect: false,
      });
      if (res?.error) {
        setEmailError(
          "Couldn't send the link right now — try Google above, or try again in a moment.",
        );
      } else {
        setSent(true);
      }
    });
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-8">
        <span className="font-display text-3xl font-bold text-crimson">
          MumRated<span className="text-gold">!</span>
        </span>
      </Link>

      <div className="w-full max-w-sm">
        <div className="card p-8 space-y-6">
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold text-dark mb-1">
              Welcome back
            </h1>
            <p className="text-muted text-sm">
              Real reviews from real Nigerian mums.
            </p>
          </div>

          {errorMessage && (
            <div className="rounded-card bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {/* Google — primary */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-3 rounded-input border border-border bg-card px-4 py-3 text-sm font-medium text-dark shadow-card-sm transition hover:shadow-card hover:border-mid disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <hr className="flex-1 border-border" />
            <span className="text-xs text-muted">or</span>
            <hr className="flex-1 border-border" />
          </div>

          {sent ? (
            <div className="rounded-card bg-[#F0F7F2] border border-[#A8D5B5] px-4 py-4 text-center space-y-1">
              <p className="text-sm font-semibold text-[#2A6B3A]">Check your inbox ✓</p>
              <p className="text-xs text-[#3B6B4A]">
                We sent a magic link to <strong className="font-medium">{email}</strong>. Click it to sign in — expires in 10 minutes.
              </p>
              <button
                onClick={() => { setSent(false); setEmail(""); }}
                className="mt-2 text-xs text-muted underline underline-offset-2"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailSignIn} className="space-y-3" noValidate>
              <div>
                <label className="label" htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(""); }}
                  placeholder="you@example.com"
                  className="mt-1 w-full rounded-input border border-border bg-card px-3.5 py-2.5 text-sm text-dark placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-crimson/40 focus:border-crimson"
                />
                {emailError && <p className="mt-1 text-xs text-red-600">{emailError}</p>}
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="btn-primary w-full disabled:opacity-60"
              >
                {isPending ? "Sending…" : "Send magic link"}
              </button>
            </form>
          )}

          <p className="text-center text-xs text-muted">
            By continuing you agree to our{" "}
            <Link href="/terms" className="underline underline-offset-2 hover:text-dark">terms</Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline underline-offset-2 hover:text-dark">privacy policy</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
