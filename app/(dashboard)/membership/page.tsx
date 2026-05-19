import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MembershipClient } from "./client";

async function fetchApi(path: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get("baoleme_session")?.value;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const res = await fetch(`${baseUrl}${path}`, {
    headers: token ? { Cookie: `baoleme_session=${token}` } : {},
    cache: "no-store",
  });
  return res.json();
}

export default async function MembershipPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("baoleme_session")?.value;

  if (!token) {
    redirect("/login");
  }

  const [currentRes, plansRes, quotaRes] = await Promise.all([
    fetchApi("/api/membership/current"),
    fetchApi("/api/membership/plans"),
    fetchApi("/api/membership/quota"),
  ]);

  return (
    <MembershipClient
      current={currentRes.success ? currentRes.data : null}
      plans={plansRes.success ? plansRes.data : []}
      quota={quotaRes.success ? quotaRes.data : {}}
    />
  );
}
