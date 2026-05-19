import { requireAuth } from "@/lib/auth";

export async function requireAdmin() {
  const session = await requireAuth();
  if (session.role !== "admin" && session.role !== "super_admin") {
    throw new AdminForbiddenError("无权限访问后台");
  }
  return { userId: session.userId, role: session.role };
}

export class AdminForbiddenError extends Error {
  code = "FORBIDDEN";
  constructor(m: string) { super(m); this.name = "AdminForbiddenError"; }
}
