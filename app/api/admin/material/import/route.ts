import { NextRequest } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { findUserById } from "@/lib/services/user.service";
import { importMaterialAccounts } from "@/lib/services/material.service";
import { ok, err, unauthorized, forbidden } from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();

    // Check admin role
    const user = await findUserById(session.userId);
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      return forbidden("无权限访问后台功能");
    }

    const body = await req.json();
    const { data } = body;

    if (!Array.isArray(data) || data.length === 0) {
      return err("VALIDATION_ERROR", "data 必须是非空数组");
    }

    const result = await importMaterialAccounts(data);
    return ok(result, `导入完成: ${result.imported} 成功, ${result.errors.length} 失败`);
  } catch (e) {
    if (e instanceof AuthError) {
      return unauthorized();
    }
    throw e;
  }
}
