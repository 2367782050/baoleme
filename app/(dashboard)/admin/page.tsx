import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminClient } from "./client";

export default async function AdminPage() {
  const c = await cookies();
  if (!c.get("baoleme_session")?.value) redirect("/login");
  return <AdminClient />;
}
