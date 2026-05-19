import { NextRequest } from "next/server";
import { signToken, setSessionCookie } from "@/lib/auth";
import { loginUser, InvalidCredentialsError } from "@/lib/services";
import { loginSchema } from "@/lib/validation/auth.schema";
import { ok, validationError, err } from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return validationError("参数错误", parsed.error.flatten().fieldErrors);
  }

  try {
    const result = await loginUser(parsed.data);

    const token = await signToken({
      userId: result.userId,
      role: result.role,
    });
    await setSessionCookie(token);

    return ok({ userId: result.userId, role: result.role }, "登录成功");
  } catch (e) {
    if (e instanceof InvalidCredentialsError) {
      return err("INVALID_CREDENTIALS", e.message, undefined, 401);
    }
    throw e;
  }
}
