import { clearSessionCookie } from "@/lib/auth";
import { ok } from "@/lib/utils/api-response";

export async function POST() {
  await clearSessionCookie();
  return ok({}, "已退出登录");
}
