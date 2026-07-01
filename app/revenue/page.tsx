import { redirect } from "next/navigation";

// Revenue merged into the unified Fees & Revenue page.
export default function RevenueRedirect() {
  redirect("/fees");
}
