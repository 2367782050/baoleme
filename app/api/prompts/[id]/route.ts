import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  getPrompt,
  updatePrompt,
  deletePrompt,
  PromptNotFoundError,
  GroupNotFoundError,
} from "@/lib/services/prompt.service";
import { ok, err, unauthorized } from "@/lib/utils/api-response";

function handleAuthError(e: unknown) {
  if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") {
    return unauthorized();
  }
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const prompt = await getPrompt(id, session.userId);
    if (!prompt) {
      return err("NOT_FOUND", "提示词不存在", undefined, 404);
    }
    return ok(prompt);
  } catch (e) {
    return handleAuthError(e) ?? (() => { throw e; })();
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const { name, content, groupId, config } = body;

    const prompt = await updatePrompt(id, session.userId, {
      name,
      content,
      groupId: groupId,
      config,
    });
    return ok(prompt, "提示词更新成功");
  } catch (e) {
    if (e instanceof PromptNotFoundError) {
      return err("NOT_FOUND", e.message, undefined, 404);
    }
    if (e instanceof GroupNotFoundError) {
      return err("NOT_FOUND", e.message, undefined, 404);
    }
    return handleAuthError(e) ?? (() => { throw e; })();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    await deletePrompt(id, session.userId);
    return ok({}, "提示词已删除");
  } catch (e) {
    if (e instanceof PromptNotFoundError) {
      return err("NOT_FOUND", e.message, undefined, 404);
    }
    return handleAuthError(e) ?? (() => { throw e; })();
  }
}
