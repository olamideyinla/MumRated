import { redirect } from "next/navigation";

// The landing page now lives at `/` via the (landing) route group.
// This file redirects any direct hit on the (mum) root to /home.
export default function MumRoot() {
  redirect("/home");
}
