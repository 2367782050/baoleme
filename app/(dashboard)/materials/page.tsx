import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MaterialsClient } from "./client";

export default async function MaterialsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("baoleme_session")?.value;

  if (!token) {
    redirect("/login");
  }

  return <MaterialsClient />;
}
