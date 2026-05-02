// Home page placeholder — will be replaced with the full HomeScreen component
// Design reference: HomeScreen in mumrated-app.html
// Layout: NavBar (top) + BottomNav (mobile) + Sidebar (desktop ≥768px) + review grid

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg">
      <div className="text-center">
        <p className="font-display text-6xl font-black text-crimson">MumRated!</p>
        <p className="mt-2 font-body text-lg text-mid italic">Say it. Rate it. Trust it.</p>
      </div>
    </main>
  );
}
