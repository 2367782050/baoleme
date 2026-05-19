import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ReferralClient } from "./client";

export default async function ReferralPage() {
  const c = await cookies();
  if (!c.get("baoleme_session")?.value) redirect("/login");
  return <ReferralClient />;
}
