import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  createGroup,
  listGroups,
  updateGroup,
  deleteGroup,
  GroupNotFoundError,
  GroupNotEmptyError,
} from "@/lib/services/prompt.service";
import { ok, err, unauthorized } from "@/lib/utils/api-response";

function handleAuthError(e: unknown) {
  if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") {
    return unauthorized();
  }
  return null;
}

export async function GET() {
  try {
    const session = await requireAuth();
    const groups = await listGroups(session.userId);
    return ok(groups);
  } catch (e) {
    return handleAuthError(e) ?? (() => { throw e; })();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const { name, description } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return err("VALIDATION_ERROR", "分组名称不能为空");
    }

    const group = await createGroup(session.userId, name.trim(), description);
    return ok(group, "分组创建成功");
  } catch (e) {
    return handleAuthError(e) ?? (() => { throw e; })();
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const { id, name, description } = body;

    if (!id) {
      return err("VALIDATION_ERROR", "id 不能为空");
    }

    const group = await updateGroup(id, session.userId, { name, description });
    return ok(group, "分组更新成功");
  } catch (e) {
    if (e instanceof GroupNotFoundError) {
      return err("NOT_FOUND", e.message, undefined, 404);
    }
    return handleAuthError(e) ?? (() => { throw e; })();
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth();
    const params = req.nextUrl.searchParams;
    const id = params.get("id");

    if (!id) {
      return err("VALIDATION_ERROR", "id 不能为空");
    }

    await deleteGroup(id, session.userId);
    return ok({}, "分组已删除");
  } catch (e) {
    if (e instanceof GroupNotFoundError) {
      return err("NOT_FOUND", e.message, undefined, 404);
    }
    if (e instanceof GroupNotEmptyError) {
      return err("GROUP_NOT_EMPTY", e.message, undefined, 409);
    }
    return handleAuthError(e) ?? (() => { throw e; })();
  }
}
