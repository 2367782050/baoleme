import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WritingClient } from "./client";

export default async function WritingPage() {
  const c = await cookies();
  if (!c.get("baoleme_session")?.value) redirect("/login");
  return <WritingClient />;
}
