import { redirect } from "next/navigation";

// Landing now lives at the root ("/"). Keep /welcome as a redirect for old links.
export default function WelcomeRedirect() {
  redirect("/");
}
