import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PromptsClient } from "./client";

export default async function PromptsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("baoleme_session")?.value;

  if (!token) {
    redirect("/login");
  }

  return <PromptsClient />;
}
