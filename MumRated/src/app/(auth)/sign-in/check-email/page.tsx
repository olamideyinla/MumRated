import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <Link href="/">
          <span className="font-display text-3xl font-bold text-crimson">
            MumRated<span className="text-gold">!</span>
          </span>
        </Link>

        <div className="card p-8 space-y-3">
          <div className="text-4xl">📬</div>
          <h1 className="font-display text-xl font-bold text-dark">
            Magic link sent
          </h1>
          <p className="text-sm text-muted leading-relaxed">
            Check your inbox and click the link we sent you. It&rsquo;ll sign
            you straight in, no password needed. It expires in 10 minutes.
          </p>
          <p className="text-xs text-muted mt-2">
            Can&rsquo;t find it? Check your spam folder.
          </p>
        </div>

        <Link href="/sign-in" className="text-sm text-mid hover:text-dark underline underline-offset-2">
          ← Try again with a different email
        </Link>
      </div>
    </div>
  );
}
