import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  createPrompt,
  listPrompts,
  GroupNotFoundError,
} from "@/lib/services/prompt.service";
import { ok, err, unauthorized } from "@/lib/utils/api-response";

function handleAuthError(e: unknown) {
  if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") {
    return unauthorized();
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const params = req.nextUrl.searchParams;
    const groupId = params.get("groupId") ?? undefined;
    const keyword = params.get("keyword") ?? undefined;

    const prompts = await listPrompts(session.userId, groupId, keyword);
    return ok(prompts);
  } catch (e) {
    return handleAuthError(e) ?? err("INTERNAL_ERROR", "服务器内部错误", undefined, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const { name, content, groupId, sourceType, config } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return err("VALIDATION_ERROR", "提示词名称不能为空");
    }
    if (!content || typeof content !== "string") {
      return err("VALIDATION_ERROR", "提示词内容不能为空");
    }

    const prompt = await createPrompt(session.userId, {
      name: name.trim(),
      content,
      groupId: groupId || undefined,
      sourceType: sourceType ?? "manual",
      config,
    });
    return ok(prompt, "提示词创建成功");
  } catch (e) {
    if (e instanceof GroupNotFoundError) {
      return err("NOT_FOUND", e.message, undefined, 404);
    }
    return handleAuthError(e) ?? err("INTERNAL_ERROR", "服务器内部错误", undefined, 500);
  }
}
