import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../lib/db/prisma.js";
import { registerUser } from "../lib/services/auth.service.js";
import {
  createGroup,
  listGroups,
  updateGroup,
  deleteGroup,
  GroupNotFoundError,
  GroupNotEmptyError,
} from "../lib/services/prompt.service.js";
import {
  createPrompt,
  listPrompts,
  getPrompt,
  updatePrompt,
  deletePrompt,
  PromptNotFoundError,
} from "../lib/services/prompt.service.js";
import {
  createGenerationJob,
  getGenerationJob,
  executeGenerationJob,
} from "../lib/services/prompt-generation.service.js";
import { QuotaExceededError, getQuotaUsage } from "../lib/services/quota.service.js";
import { mockAIProvider } from "../lib/adapters/ai/mock-provider.js";

describe("Prompt groups CRUD", () => {
  const username = `grp_${Date.now().toString(36)}`;
  const username2 = `grp2_${Date.now().toString(36)}`;
  let userId: string;
  let userId2: string;

  beforeAll(async () => {
    const u1 = await registerUser({
      username,
      email: `grp_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });
    userId = u1.user.id;

    const u2 = await registerUser({
      username: username2,
      email: `grp2_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });
    userId2 = u2.user.id;
  });

  afterAll(async () => {
    // Cleanup: delete prompts first
    await prisma.prompt.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.promptGroup.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.quotaUsage.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.userMembership.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, userId2] } } });
  });

  it("creates a group", async () => {
    const g = await createGroup(userId, "财经类", "财经相关提示词");
    expect(g.name).toBe("财经类");
    expect(g.userId).toBe(userId);
  });

  it("listGroups returns only your own", async () => {
    await createGroup(userId2, "科技类");
    const list = await listGroups(userId);
    expect(list.every((g) => g.userId === userId)).toBe(true);
  });

  it("updates own group", async () => {
    const g = await createGroup(userId, "待改名");
    const updated = await updateGroup(g.id, userId, { name: "已改名" });
    expect(updated.name).toBe("已改名");
  });

  it("cannot update another user's group", async () => {
    const g = await createGroup(userId2, "别人的分组");
    await expect(updateGroup(g.id, userId, { name: "不能改" })).rejects.toThrow(GroupNotFoundError);
  });

  it("deletes empty group", async () => {
    const g = await createGroup(userId, "待删除");
    await deleteGroup(g.id, userId);
    const after = await listGroups(userId);
    expect(after.find((x) => x.id === g.id)).toBeUndefined();
  });

  it("cannot delete non-empty group", async () => {
    const g = await createGroup(userId, "有内容的组");
    await createPrompt(userId, { name: "p1", content: "c1", groupId: g.id });
    await expect(deleteGroup(g.id, userId)).rejects.toThrow(GroupNotEmptyError);
  });
});

describe("Prompts CRUD", () => {
  const username = `prm_${Date.now().toString(36)}`;
  const username2 = `prm2_${Date.now().toString(36)}`;
  let userId: string;
  let userId2: string;
  let groupId: string;

  beforeAll(async () => {
    const u1 = await registerUser({
      username,
      email: `prm_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });
    userId = u1.user.id;
    const g = await createGroup(userId, "测试分组");
    groupId = g.id;

    const u2 = await registerUser({
      username: username2,
      email: `prm2_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });
    userId2 = u2.user.id;
  });

  afterAll(async () => {
    await prisma.prompt.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.promptGroup.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.quotaUsage.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.userMembership.deleteMany({ where: { userId: { in: [userId, userId2] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, userId2] } } });
  });

  it("creates a prompt", async () => {
    const p = await createPrompt(userId, { name: "测试提示词", content: "这是内容", groupId });
    expect(p.name).toBe("测试提示词");
    expect(p.userId).toBe(userId);
    expect(p.sourceType).toBe("manual");
  });

  it("creates a prompt without group", async () => {
    const p = await createPrompt(userId, { name: "未分组", content: "x" });
    expect(p.groupId).toBeNull();
  });

  it("listPrompts returns only own prompts", async () => {
    await createPrompt(userId2, { name: "别人的", content: "x" });
    const list = await listPrompts(userId);
    expect(list.every((p) => p.userId === userId)).toBe(true);
  });

  it("filters by groupId", async () => {
    const list = await listPrompts(userId, groupId);
    expect(list.every((p) => p.groupId === groupId)).toBe(true);
  });

  it("searches by keyword", async () => {
    await createPrompt(userId, { name: "包含关键字ABC", content: "x" });
    const list = await listPrompts(userId, undefined, "ABC");
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list.some((p) => p.name.includes("ABC"))).toBe(true);
  });

  it("cannot get another user's prompt", async () => {
    const p = await createPrompt(userId2, { name: "别人的提示词", content: "x" });
    const found = await getPrompt(p.id, userId);
    expect(found).toBeNull();
  });

  it("updates own prompt", async () => {
    const p = await createPrompt(userId, { name: "旧名", content: "旧内容" });
    const updated = await updatePrompt(p.id, userId, { name: "新名" });
    expect(updated.name).toBe("新名");
  });

  it("cannot update another user's prompt", async () => {
    const p = await createPrompt(userId2, { name: "别人的", content: "x" });
    await expect(updatePrompt(p.id, userId, { name: "不能改" })).rejects.toThrow(PromptNotFoundError);
  });

  it("deletes own prompt", async () => {
    const p = await createPrompt(userId, { name: "待删除", content: "x" });
    await deletePrompt(p.id, userId);
    const found = await getPrompt(p.id, userId);
    expect(found).toBeNull();
  });

  it("rejects createPrompt with invalid groupId", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    await expect(
      createPrompt(userId, { name: "x", content: "x", groupId: fakeId }),
    ).rejects.toThrow(GroupNotFoundError);
  });
});

describe("Prompt generation jobs", () => {
  const username = `gen_${Date.now().toString(36)}`;
  let userId: string;

  beforeAll(async () => {
    const u = await registerUser({
      username,
      email: `gen_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });
    userId = u.user.id;
  });

  afterAll(async () => {
    await prisma.promptGenerationJob.deleteMany({ where: { userId } });
    await prisma.prompt.deleteMany({ where: { userId } });
    await prisma.promptGroup.deleteMany({ where: { userId } });
    await prisma.quotaUsage.deleteMany({ where: { userId } });
    await prisma.userMembership.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it("creates a generation job and returns jobId", async () => {
    const job = await createGenerationJob(userId, null, {
      name: "测试生成",
      contentDomain: "财经",
      targetAudience: "职场人",
      authorName: "测试作者",
      personaDetails: "细节",
      personalityTraits: ["理性"],
      headingStyle: "numbered",
      wordCount: 1500,
      enableAIDetectionEvasion: false,
      materialAnalysisJson: "{}",
      userNotes: "",
    });
    expect(job.id).toBeTruthy();
    expect(job.status).toBe("pending");
  });

  it("executeGenerationJob moves to completed and saves prompt", async () => {
    const job = await createGenerationJob(userId, null, {
      name: "财经爆款生成测试",
      contentDomain: "财经",
      targetAudience: "职场人",
      authorName: "财经观察者",
      personaDetails: "长期关注",
      personalityTraits: ["理性分析"],
      headingStyle: "numbered",
      wordCount: 1800,
      enableAIDetectionEvasion: true,
      materialAnalysisJson: "{}",
      userNotes: "",
    });

    await executeGenerationJob(job.id);

    const updated = await getGenerationJob(job.id, userId);
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("completed");
    expect(updated!.outputPromptId).toBeTruthy();

    // Verify the prompt was created
    const prompt = await prisma.prompt.findUnique({ where: { id: updated!.outputPromptId! } });
    expect(prompt).not.toBeNull();
    expect(prompt!.sourceType).toBe("generated");
    expect(prompt!.content).toContain("【写作身份】");
  });

  it("executeGenerationJob fails and records errorMessage", async () => {
    mockAIProvider.setFailNext(true);

    const job = await createGenerationJob(userId, null, {
      name: "失败测试",
      contentDomain: "财经",
      targetAudience: "x",
      authorName: "x",
      personaDetails: "x",
      personalityTraits: ["x"],
      headingStyle: "numbered",
      wordCount: 100,
      enableAIDetectionEvasion: false,
      materialAnalysisJson: "{}",
      userNotes: "",
    });

    try {
      await executeGenerationJob(job.id);
    } catch {
      // expected
    }

    const updated = await getGenerationJob(job.id, userId);
    expect(updated!.status).toBe("failed");
    expect(updated!.errorMessage).toContain("Mock AI failure");
    expect(updated!.outputPromptId).toBeNull();
  });

  it("getGenerationJob returns null for another user", async () => {
    const otherUser = await registerUser({
      username: `other_${Date.now().toString(36)}`,
      email: `other_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });

    const job = await createGenerationJob(userId, null, {
      name: "x",
      contentDomain: "x",
      targetAudience: "x",
      authorName: "x",
      personaDetails: "x",
      personalityTraits: ["x"],
      headingStyle: "numbered",
      wordCount: 100,
      enableAIDetectionEvasion: false,
      materialAnalysisJson: "{}",
      userNotes: "",
    });

    const notMine = await getGenerationJob(job.id, otherUser.user.id);
    expect(notMine).toBeNull();

    // cleanup
    await prisma.promptGenerationJob.deleteMany({ where: { userId: otherUser.user.id } });
    await prisma.prompt.deleteMany({ where: { userId: otherUser.user.id } });
    await prisma.promptGroup.deleteMany({ where: { userId: otherUser.user.id } });
    await prisma.quotaUsage.deleteMany({ where: { userId: otherUser.user.id } });
    await prisma.userMembership.deleteMany({ where: { userId: otherUser.user.id } });
    await prisma.user.delete({ where: { id: otherUser.user.id } }).catch(() => {});
  });
});

describe("Prompt generate quota", () => {
  const username = `qta_${Date.now().toString(36)}`;
  let userId: string;

  beforeAll(async () => {
    const u = await registerUser({
      username,
      email: `qta_${Date.now().toString(36)}@example.com`,
      password: "test1234",
    });
    userId = u.user.id;
  });

  afterAll(async () => {
    await prisma.promptGenerationJob.deleteMany({ where: { userId } });
    await prisma.prompt.deleteMany({ where: { userId } });
    await prisma.quotaUsage.deleteMany({ where: { userId } });
    await prisma.userMembership.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  it("consumes prompt_generate quota on success", async () => {
    const job = await createGenerationJob(userId, null, {
      name: "配额测试",
      contentDomain: "x",
      targetAudience: "x",
      authorName: "x",
      personaDetails: "x",
      personalityTraits: ["x"],
      headingStyle: "numbered",
      wordCount: 100,
      enableAIDetectionEvasion: false,
      materialAnalysisJson: "{}",
      userNotes: "",
    });

    await executeGenerationJob(job.id);

    const usage = await prisma.quotaUsage.findFirst({
      where: { userId, capability: "prompt_generate" },
    });
    expect(usage).not.toBeNull();
    expect(usage!.used).toBeGreaterThanOrEqual(1);
  });

  it("quota exceeded prevents job creation when usage reaches limit", async () => {
    // Artificially fill quota_usage to the free plan limit (5)
    const now = new Date();
    const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    await prisma.quotaUsage.upsert({
      where: {
        userId_capability_periodType_periodKey: {
          userId,
          capability: "prompt_generate",
          periodType: "monthly",
          periodKey,
        },
      },
      create: {
        userId,
        capability: "prompt_generate",
        periodType: "monthly",
        periodKey,
        used: 5,
      },
      update: {
        used: 5,
      },
    });

    // Count existing jobs before
    const jobsBefore = await prisma.promptGenerationJob.count({ where: { userId } });

    // Now createGenerationJob should throw QuotaExceededError
    await expect(
      createGenerationJob(userId, null, {
        name: "配额超限测试",
        contentDomain: "x",
        targetAudience: "x",
        authorName: "x",
        personaDetails: "x",
        personalityTraits: ["x"],
        headingStyle: "numbered",
        wordCount: 100,
        enableAIDetectionEvasion: false,
        materialAnalysisJson: "{}",
        userNotes: "",
      }),
    ).rejects.toThrow(QuotaExceededError);

    // No new job should have been created
    const jobsAfter = await prisma.promptGenerationJob.count({ where: { userId } });
    expect(jobsAfter).toBe(jobsBefore);

    // Usage should NOT have been incremented
    const { used } = await getQuotaUsage(userId, "prompt_generate");
    expect(used).toBe(5);
  });
});
