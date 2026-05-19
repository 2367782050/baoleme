import { NextRequest } from "next/server";
import { signToken, setSessionCookie } from "@/lib/auth";
import { registerUser, verifyEmailCode, UserExistsError } from "@/lib/services";
import { registerSchema } from "@/lib/validation/auth.schema";
import { ok, validationError, err } from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return validationError("参数错误", parsed.error.flatten().fieldErrors);
  }

  const { username, email, password, emailCode, referralCode } = parsed.data;

  // Verify email code
  const validCode = await verifyEmailCode(email, emailCode, "register");
  if (!validCode) {
    return validationError("验证码错误或已过期");
  }

  try {
    const result = await registerUser({
      username,
      email,
      password,
      referralCode: referralCode || undefined,
    });

    // Sign JWT and set cookie
    const token = await signToken({
      userId: result.user.id,
      role: result.user.role,
    });
    await setSessionCookie(token);

    return ok(result);
  } catch (e) {
    if (e instanceof UserExistsError) {
      return err("USER_EXISTS", e.message, undefined, 409);
    }
    return err("INTERNAL_ERROR", "服务器内部错误", undefined, 500);
  }
}
