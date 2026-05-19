import { z } from "zod";

export const sendEmailCodeSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
  purpose: z.enum(["register", "reset_password"]),
});

export const registerSchema = z.object({
  username: z
    .string()
    .min(4, "用户名至少 4 位")
    .max(20, "用户名最多 20 位"),
  email: z.string().email("邮箱格式不正确"),
  password: z.string().min(8, "密码至少 8 位"),
  emailCode: z.string().min(1, "请输入验证码"),
  referralCode: z.string().optional(),
});

export const loginSchema = z.object({
  account: z.string().min(1, "请输入账号"),
  password: z.string().min(1, "请输入密码"),
});

export type SendEmailCodeInput = z.infer<typeof sendEmailCodeSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
