import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/db/prisma.js";
import {
  registerUser,
  loginUser,
  sendEmailCode,
  verifyEmailCode,
  UserExistsError,
  InvalidCredentialsError,
} from "../lib/services/auth.service.js";
import { findActiveMembership } from "../lib/services/membership.service.js";
import { getQuotaUsage, consume, assertCanUse } from "../lib/services/quota.service.js";

describe("Registration", () => {
  const testPrefix = Date.now();
  let createdUserId: string;

  afterAll(async () => {
    if (createdUserId) {
      await prisma.quotaUsage.deleteMany({ where: { userId: createdUserId } });
      await prisma.userMembership.deleteMany({ where: { userId: createdUserId } });
      await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
    }
  });

  it("should register a new user successfully", async () => {
    const result = await registerUser({
      username: `testreg_${testPrefix}`,
      email: `testreg_${testPrefix}@example.com`,
      password: "password123",
    });
    createdUserId = result.user.id;

    expect(result.user.username).toBe(`testreg_${testPrefix}`);
    expect(result.user.email).toBe(`testreg_${testPrefix}@example.com`);
    expect(result.user.role).toBe("user");
  });

  it("should grant free membership on registration", async () => {
    const membership = await findActiveMembership(createdUserId);
    expect(membership).not.toBeNull();
    expect(membership!.plan.code).toBe("free");
    expect(membership!.status).toBe("active");
  });

  it("should reject duplicate username", async () => {
    await expect(
      registerUser({
        username: `testreg_${testPrefix}`,
        email: `different_${testPrefix}@example.com`,
        password: "password123",
      }),
    ).rejects.toThrow(UserExistsError);
  });

  it("should reject duplicate email", async () => {
    await expect(
      registerUser({
        username: `different_${testPrefix}`,
        email: `testreg_${testPrefix}@example.com`,
        password: "password123",
      }),
    ).rejects.toThrow(UserExistsError);
  });
});

describe("Email verification code", () => {
  const testEmail = `code_${Date.now()}@example.com`;

  afterAll(async () => {
    await prisma.emailVerificationCode.deleteMany({ where: { email: testEmail } });
  });

  it("sendEmailCode creates a valid code", async () => {
    const code = await sendEmailCode(testEmail, "register");
    expect(code).toMatch(/^\d{6}$/);
  });

  it("verifyEmailCode accepts valid code", async () => {
    const code = await sendEmailCode(testEmail, "register");
    const result = await verifyEmailCode(testEmail, code, "register");
    expect(result).toBe(true);
  });

  it("verifyEmailCode rejects consumed code", async () => {
    const code = await sendEmailCode(testEmail, "register");
    await verifyEmailCode(testEmail, code, "register");
    const second = await verifyEmailCode(testEmail, code, "register");
    expect(second).toBe(false);
  });

  it("verifyEmailCode rejects wrong code", async () => {
    await sendEmailCode(testEmail, "register");
    const result = await verifyEmailCode(testEmail, "000000", "register");
    expect(result).toBe(false);
  });
});

describe("Login", () => {
  const testPrefix = Date.now();
  let createdUserId: string;

  beforeAll(async () => {
    const result = await registerUser({
      username: `testlogin_${testPrefix}`,
      email: `testlogin_${testPrefix}@example.com`,
      password: "password123",
    });
    createdUserId = result.user.id;
  });

  afterAll(async () => {
    if (createdUserId) {
      await prisma.quotaUsage.deleteMany({ where: { userId: createdUserId } });
      await prisma.userMembership.deleteMany({ where: { userId: createdUserId } });
      await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
    }
  });

  it("should login with username and correct password", async () => {
    const result = await loginUser({
      account: `testlogin_${testPrefix}`,
      password: "password123",
    });
    expect(result.userId).toBe(createdUserId);
    expect(result.role).toBe("user");
  });

  it("should login with email and correct password", async () => {
    const result = await loginUser({
      account: `testlogin_${testPrefix}@example.com`,
      password: "password123",
    });
    expect(result.userId).toBe(createdUserId);
  });

  it("should reject wrong password", async () => {
    await expect(
      loginUser({
        account: `testlogin_${testPrefix}`,
        password: "wrongpassword",
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it("should reject nonexistent account", async () => {
    await expect(
      loginUser({
        account: `nonexistent_${testPrefix}`,
        password: "anything",
      }),
    ).rejects.toThrow(InvalidCredentialsError);
  });
});

describe("Quota service integration", () => {
  const testPrefix = Date.now();
  let createdUserId: string;

  beforeAll(async () => {
    const result = await registerUser({
      username: `qtest_${testPrefix}`,
      email: `qtest_${testPrefix}@example.com`,
      password: "password123",
    });
    createdUserId = result.user.id;
  });

  afterAll(async () => {
    if (createdUserId) {
      await prisma.quotaUsage.deleteMany({ where: { userId: createdUserId } });
      await prisma.userMembership.deleteMany({ where: { userId: createdUserId } });
      await prisma.user.delete({ where: { id: createdUserId } }).catch(() => {});
    }
  });

  it("free plan user has article_generate limit 1", async () => {
    const { used, limit } = await getQuotaUsage(createdUserId, "article_generate");
    expect(used).toBe(0);
    expect(limit).toBe(1);
  });

  it("assertCanUse passes for free user within limit", async () => {
    await expect(assertCanUse(createdUserId, "article_generate")).resolves.toBeUndefined();
  });

  it("consume uses quota, then assertCanUse throws QUOTA_EXCEEDED", async () => {
    await consume(createdUserId, "article_generate", 1);
    try {
      await assertCanUse(createdUserId, "article_generate");
      expect.unreachable("Expected QUOTA_EXCEEDED error");
    } catch (e) {
      expect((e as { code?: string }).code).toBe("QUOTA_EXCEEDED");
    }
  });
});
