import { NextRequest } from "next/server";
import { sendEmailCode } from "@/lib/services/auth.service";
import { sendEmailCodeSchema } from "@/lib/validation/auth.schema";
import { ok, validationError } from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = sendEmailCodeSchema.safeParse(body);
  if (!parsed.success) {
    return validationError("参数错误", parsed.error.flatten().fieldErrors);
  }

  const { email, purpose } = parsed.data;
  const code = await sendEmailCode(email, purpose);

  // In dev/test, return the code for convenience
  if (process.env.NODE_ENV !== "production") {
    return ok({ code }, "验证码已发送（开发环境返回 code）");
  }

  return ok({}, "验证码已发送");
}
