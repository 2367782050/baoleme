import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createUser, findUserByEmail, findUserByUsername } from "./user.service";
import { findPlanByCode, createUserMembership } from "./membership.service";

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

export async function sendEmailCode(email: string, purpose: string): Promise<string> {
  // Generate a 6-digit code
  const code = crypto.randomInt(100000, 999999).toString();
  const codeHash = hashCode(code);

  await prisma.emailVerificationCode.create({
    data: {
      email,
      codeHash,
      purpose,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
  });

  return code;
}

export async function verifyEmailCode(
  email: string,
  code: string,
  purpose: string,
): Promise<boolean> {
  const codeHash = hashCode(code);
  const record = await prisma.emailVerificationCode.findFirst({
    where: {
      email,
      codeHash,
      purpose,
      expiresAt: { gt: new Date() },
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record) return false;

  // Mark as consumed
  await prisma.emailVerificationCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  return true;
}

export async function registerUser(input: {
  username: string;
  email: string;
  password: string;
  referralCode?: string;
}): Promise<{ user: { id: string; username: string; email: string; role: string } }> {
  // Check for existing username
  const existingUsername = await findUserByUsername(input.username);
  if (existingUsername) {
    throw new UserExistsError("用户名已存在");
  }

  // Check for existing email
  const existingEmail = await findUserByEmail(input.email);
  if (existingEmail) {
    throw new UserExistsError("邮箱已注册");
  }

  const passwordHash = await hashPassword(input.password);

  // Resolve referralCode -> userId
  let referredByUserId: string | undefined;
  if (input.referralCode) {
    const referrer = await prisma.user.findUnique({
      where: { referralCode: input.referralCode },
    });
    if (referrer && referrer.id) {
      referredByUserId = referrer.id;
    }
  }

  const user = await createUser({
    username: input.username,
    email: input.email,
    passwordHash,
    referredByUserId: referredByUserId ?? undefined,
  });

  // Grant free membership on registration
  const freePlan = await findPlanByCode("free");
  if (freePlan) {
    await createUserMembership(user.id, freePlan.id, "trial");
  }

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  };
}

export async function loginUser(input: {
  account: string;
  password: string;
}): Promise<{ userId: string; role: string }> {
  // Try username first, then email
  let user = await findUserByUsername(input.account);
  if (!user) {
    user = await findUserByEmail(input.account);
  }

  if (!user) {
    throw new InvalidCredentialsError("账号不存在");
  }

  if (user.status === "disabled") {
    throw new InvalidCredentialsError("账号已禁用");
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw new InvalidCredentialsError("密码错误");
  }

  // Update last login time
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return { userId: user.id, role: user.role };
}

export class UserExistsError extends Error {
  code = "USER_EXISTS";

  constructor(message: string) {
    super(message);
    this.name = "UserExistsError";
  }
}

export class InvalidCredentialsError extends Error {
  code = "INVALID_CREDENTIALS";

  constructor(message: string) {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}
