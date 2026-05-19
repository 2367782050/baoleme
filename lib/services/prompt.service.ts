import { prisma } from "@/lib/db";
import type { Prisma, PromptGroup, Prompt } from "@/lib/generated/prisma/client";

// ─── Groups CRUD ──────────────────────────────────────────────────

export async function createGroup(userId: string, name: string, description?: string): Promise<PromptGroup> {
  return prisma.promptGroup.create({
    data: { userId, name, description: description ?? null },
  });
}

export async function listGroups(userId: string): Promise<PromptGroup[]> {
  return prisma.promptGroup.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export async function updateGroup(
  groupId: string,
  userId: string,
  data: { name?: string; description?: string },
): Promise<PromptGroup> {
  const group = await prisma.promptGroup.findUnique({ where: { id: groupId } });
  if (!group || group.userId !== userId) {
    throw new GroupNotFoundError("分组不存在");
  }
  return prisma.promptGroup.update({
    where: { id: groupId },
    data,
  });
}

export async function deleteGroup(groupId: string, userId: string): Promise<void> {
  const group = await prisma.promptGroup.findUnique({ where: { id: groupId } });
  if (!group || group.userId !== userId) {
    throw new GroupNotFoundError("分组不存在");
  }

  // Check if group has prompts
  const promptCount = await prisma.prompt.count({ where: { groupId } });
  if (promptCount > 0) {
    throw new GroupNotEmptyError("分组不为空，请先删除或移出分组内的提示词");
  }

  await prisma.promptGroup.delete({ where: { id: groupId } });
}

// ─── Prompts CRUD ─────────────────────────────────────────────────

export async function createPrompt(
  userId: string,
  data: {
    name: string;
    content: string;
    groupId?: string;
    sourceType?: string;
    config?: Record<string, unknown>;
  },
): Promise<Prompt> {
  // If groupId is provided, verify it belongs to this user
  if (data.groupId) {
    const group = await prisma.promptGroup.findUnique({ where: { id: data.groupId } });
    if (!group || group.userId !== userId) {
      throw new GroupNotFoundError("分组不存在");
    }
  }

  return prisma.prompt.create({
    data: {
      userId,
      name: data.name,
      content: data.content,
      groupId: data.groupId ?? null,
      sourceType: data.sourceType ?? "manual",
      config: data.config ? (data.config as Prisma.InputJsonValue) : undefined,
    },
  });
}

export async function listPrompts(
  userId: string,
  groupId?: string,
  keyword?: string,
): Promise<Prompt[]> {
  const where: { userId: string; groupId?: string; name?: { contains: string; mode: "insensitive" } } = {
    userId,
  };
  if (groupId) where.groupId = groupId;
  if (keyword) where.name = { contains: keyword, mode: "insensitive" };

  return prisma.prompt.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: { group: true },
  });
}

export async function getPrompt(promptId: string, userId: string): Promise<Prompt | null> {
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    include: { group: true },
  });
  if (!prompt || prompt.userId !== userId) return null;
  return prompt;
}

export async function updatePrompt(
  promptId: string,
  userId: string,
  data: {
    name?: string;
    content?: string;
    groupId?: string | null;
    config?: Record<string, unknown>;
  },
): Promise<Prompt> {
  const prompt = await prisma.prompt.findUnique({ where: { id: promptId } });
  if (!prompt || prompt.userId !== userId) {
    throw new PromptNotFoundError("提示词不存在");
  }

  // If changing groupId, verify it belongs to this user
  if (data.groupId) {
    const group = await prisma.promptGroup.findUnique({ where: { id: data.groupId } });
    if (!group || group.userId !== userId) {
      throw new GroupNotFoundError("分组不存在");
    }
  }

  return prisma.prompt.update({
    where: { id: promptId },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.groupId !== undefined ? { groupId: data.groupId || null } : {}),
      ...(data.config !== undefined ? { config: data.config as Prisma.InputJsonValue } : {}),
    },
  });
}

export async function deletePrompt(promptId: string, userId: string): Promise<void> {
  const prompt = await prisma.prompt.findUnique({ where: { id: promptId } });
  if (!prompt || prompt.userId !== userId) {
    throw new PromptNotFoundError("提示词不存在");
  }
  await prisma.prompt.delete({ where: { id: promptId } });
}

// ─── Error classes ────────────────────────────────────────────────

export class GroupNotFoundError extends Error {
  code = "NOT_FOUND";

  constructor(message: string) {
    super(message);
    this.name = "GroupNotFoundError";
  }
}

export class GroupNotEmptyError extends Error {
  code = "GROUP_NOT_EMPTY";

  constructor(message: string) {
    super(message);
    this.name = "GroupNotEmptyError";
  }
}

export class PromptNotFoundError extends Error {
  code = "NOT_FOUND";

  constructor(message: string) {
    super(message);
    this.name = "PromptNotFoundError";
  }
}
