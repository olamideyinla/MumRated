import { Suspense } from "react";
import SignInForm from "./SignInForm";

export const metadata = {
  title: "Sign in — MumRated!",
};

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <SignInForm />
    </Suspense>
  );
}
