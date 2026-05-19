import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "baoleme_session";

// Lazy import to avoid circular deps — only used in requireAuth
async function getUserStatus(userId: string): Promise<{ status: string; role: string } | null> {
  const { prisma } = await import("@/lib/db");
  return prisma.user.findUnique({ where: { id: userId }, select: { status: true, role: true } });
}

function getSecret() {
  const secret = process.env.JWT_SECRET ?? "baoleme-dev-secret-change-in-production";
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  userId: string;
  role: string;
};

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new AuthError("未登录");
  }
  // Check user status — disabled users are rejected
  const user = await getUserStatus(session.userId);
  if (!user) {
    throw new AuthError("用户不存在");
  }
  if (user.status === "disabled") {
    throw new AuthError("账号已禁用");
  }
  // Keep role in sync with DB
  return { userId: session.userId, role: user.role };
}

export class AuthError extends Error {
  code = "UNAUTHORIZED";

  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
