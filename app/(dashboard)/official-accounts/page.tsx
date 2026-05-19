import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { OAClient } from "./client";

export default async function OfficialAccountsPage() {
  const c = await cookies();
  if (!c.get("baoleme_session")?.value) redirect("/login");
  return <OAClient />;
}
