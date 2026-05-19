import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createArticleGroup, listArticleGroups, updateArticleGroup, deleteArticleGroup, ArticleGroupNotFoundError, ArticleGroupNotEmptyError } from "@/lib/services/article.service";
import { ok, err, unauthorized } from "@/lib/utils/api-response";

function ua(e: unknown) {
  if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized();
  return null;
}

export async function GET() {
  try { const s = await requireAuth(); return ok(await listArticleGroups(s.userId)); }
  catch (e) { return ua(e) ?? (() => { throw e; })(); }
}

export async function POST(req: NextRequest) {
  try { const s = await requireAuth(); const { name, description } = await req.json();
    if (!name || !name.trim()) return err("VALIDATION_ERROR", "分组名称不能为空");
    return ok(await createArticleGroup(s.userId, name.trim(), description), "分组创建成功"); }
  catch (e) { return ua(e) ?? (() => { throw e; })(); }
}

export async function PUT(req: NextRequest) {
  try { const s = await requireAuth(); const { id, name, description } = await req.json();
    if (!id) return err("VALIDATION_ERROR", "id 不能为空");
    return ok(await updateArticleGroup(id, s.userId, { name, description }), "分组更新成功"); }
  catch (e) { if (e instanceof ArticleGroupNotFoundError) return err("NOT_FOUND", e.message, undefined, 404); return ua(e) ?? (() => { throw e; })(); }
}

export async function DELETE(req: NextRequest) {
  try { const s = await requireAuth(); const id = req.nextUrl.searchParams.get("id");
    if (!id) return err("VALIDATION_ERROR", "id 不能为空");
    await deleteArticleGroup(id, s.userId); return ok({}, "分组已删除"); }
  catch (e) { if (e instanceof ArticleGroupNotFoundError) return err("NOT_FOUND", e.message, undefined, 404);
    if (e instanceof ArticleGroupNotEmptyError) return err("GROUP_NOT_EMPTY", e.message, undefined, 409);
    return ua(e) ?? (() => { throw e; })(); }
}
