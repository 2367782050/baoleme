import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "../lib/db/prisma.js";
import {
  createUser,
  findUserByUsername,
  findUserByEmail,
  findUserById,
} from "../lib/services/user.service.js";
import {
  listActivePlans,
  findPlanByCode,
  createUserMembership,
  findActiveMembership,
  getPlanCapabilities,
} from "../lib/services/membership.service.js";
import {
  getQuotaUsage,
  assertCanUse,
  consume,
  QuotaExceededError,
} from "../lib/services/quota.service.js";

describe("MembershipPlan queries via service", () => {
  it("listActivePlans returns at least 3 active plans", async () => {
    const plans = await listActivePlans();
    expect(plans.length).toBeGreaterThanOrEqual(3);
    expect(plans.map((p) => p.code).sort()).toEqual(
      expect.arrayContaining(["free", "pro", "enterprise"]),
    );
  });

  it("findPlanByCode returns free plan with correct defaults", async () => {
    const plan = await findPlanByCode("free");
    expect(plan).not.toBeNull();
    expect(plan!.priceCents).toBe(0);
    const caps = getPlanCapabilities(plan!);
    expect(caps.article_generate_daily).toBe(1);
  });

  it("findPlanByCode returns pro plan with correct pricing", async () => {
    const plan = await findPlanByCode("pro");
    expect(plan).not.toBeNull();
    expect(plan!.priceCents).toBe(2900);
    expect(plan!.originalPriceCents).toBe(5900);
  });
});

describe("User service", () => {
  const testUsername = `svc_user_${Date.now()}`;
  const testEmail = `svc_${Date.now()}@example.com`;
  let userId: string;

  afterAll(async () => {
    if (userId) {
      await prisma.quotaUsage.deleteMany({ where: { userId } });
      await prisma.userMembership.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it("createUser creates a user with defaults", async () => {
    const user = await createUser({
      username: testUsername,
      email: testEmail,
      passwordHash: "hashed_password_xyz",
    });
    userId = user.id;

    expect(user.id).toBeTruthy();
    expect(user.username).toBe(testUsername);
    expect(user.email).toBe(testEmail);
    expect(user.role).toBe("user");
    expect(user.status).toBe("active");
    expect(user.referralCode).toBeTruthy();
  });

  it("findUserByUsername finds the created user", async () => {
    const user = await findUserByUsername(testUsername);
    expect(user).not.toBeNull();
    expect(user!.email).toBe(testEmail);
  });

  it("findUserByEmail finds the created user", async () => {
    const user = await findUserByEmail(testEmail);
    expect(user).not.toBeNull();
    expect(user!.username).toBe(testUsername);
  });

  it("findUserById finds the created user", async () => {
    const user = await findUserById(userId);
    expect(user).not.toBeNull();
    expect(user!.username).toBe(testUsername);
  });

  it("createUser rejects duplicate username", async () => {
    await expect(
      createUser({
        username: testUsername,
        email: `dup_username_${Date.now()}@example.com`,
        passwordHash: "hash",
      }),
    ).rejects.toThrow();
  });

  it("createUser rejects duplicate email", async () => {
    await expect(
      createUser({
        username: `dup_email_${Date.now()}`,
        email: testEmail,
        passwordHash: "hash",
      }),
    ).rejects.toThrow();
  });
});

describe("Quota service via service layer", () => {
  const testUsername = `qsvc_${Date.now()}`;
  let userId: string;

  beforeAll(async () => {
    const user = await createUser({
      username: testUsername,
      email: `qsvc_${Date.now()}@example.com`,
      passwordHash: "hash",
    });
    userId = user.id;

    const freePlan = await findPlanByCode("free");
    await createUserMembership(userId, freePlan!.id, "trial", 36500);
  });

  afterAll(async () => {
    if (userId) {
      await prisma.quotaUsage.deleteMany({ where: { userId } });
      await prisma.userMembership.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it("getQuotaUsage starts with used=0 and limit from plan", async () => {
    const { used, limit } = await getQuotaUsage(userId, "article_generate");
    expect(used).toBe(0);
    expect(limit).toBe(1);
  });

  it("assertCanUse passes when quota not exceeded", async () => {
    await expect(assertCanUse(userId, "article_generate")).resolves.toBeUndefined();
  });

  it("consume increments usage", async () => {
    await consume(userId, "article_generate", 1);
    const { used } = await getQuotaUsage(userId, "article_generate");
    expect(used).toBe(1);
  });

  it("assertCanUse throws QuotaExceededError when limit reached", async () => {
    try {
      await assertCanUse(userId, "article_generate");
      expect.unreachable("Expected QuotaExceededError");
    } catch (e) {
      expect(e).toBeInstanceOf(QuotaExceededError);
      expect((e as QuotaExceededError).code).toBe("QUOTA_EXCEEDED");
    }
  });

  it("findActiveMembership returns the active membership with plan", async () => {
    const membership = await findActiveMembership(userId);
    expect(membership).not.toBeNull();
    expect(membership!.plan.code).toBe("free");
    expect(membership!.status).toBe("active");
  });
});
