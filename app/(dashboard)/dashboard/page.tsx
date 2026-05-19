import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DashboardClient } from "./client";

async function getSessionData() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("baoleme_session")?.value;
    if (!token) return null;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: `baoleme_session=${token}` },
      cache: "no-store",
    });
    const data = await res.json();
    if (!data.success) return null;
    return data.data;
  } catch {
    return null;
  }
}

export default async function DashboardPage() {
  const sessionData = await getSessionData();

  if (!sessionData) {
    redirect("/login");
  }

  return <DashboardClient data={sessionData} />;
}
