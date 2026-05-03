import type { Metadata } from "next";
import ProviderSignUpForm from "./ProviderSignUpForm";

export const metadata: Metadata = {
  title: "Claim your listing — MumRated!",
  description:
    "Claim and manage your listing on MumRated. Identity verified; rankings driven by mum reviews only.",
};

export default function ProviderSignUpPage() {
  return (
    <div className="min-h-screen bg-[#F5EDE0] flex flex-col">
      {/* Top bar */}
      <header className="bg-[#3B2010] px-6 py-4">
        <a href="/" className="font-display text-xl font-bold text-[#C9A227]">
          MumRated!
        </a>
      </header>

      <div className="flex-1 container max-w-lg py-12 px-4">
        {/* Trust boundary notice — visible before sign-up */}
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          <strong>Ranking transparency:</strong> Claiming your listing has no
          effect on your position in search results or category pages. Mum
          reviews are the only factor. This is a core principle of MumRated.
        </div>

        <div className="card p-8">
          <h1 className="font-display text-2xl font-bold text-dark mb-1">
            Claim your listing
          </h1>
          <p className="text-sm text-muted mb-6">
            Verify your identity, respond to reviews, and keep your listing
            profile up to date.
          </p>

          <ProviderSignUpForm />
        </div>

        <p className="text-xs text-muted text-center mt-4">
          Already claimed?{" "}
          <a href="/sign-in" className="underline hover:text-dark">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
