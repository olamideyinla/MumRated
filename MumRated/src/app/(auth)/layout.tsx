// Auth pages (sign-in, check-email), no NavBar, plain background
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
