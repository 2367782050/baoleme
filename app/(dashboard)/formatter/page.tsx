import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FormatterClient } from "./client";

export default async function FormatterPage() {
  const c = await cookies();
  if (!c.get("baoleme_session")?.value) redirect("/login");
  return <FormatterClient />;
}
