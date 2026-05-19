import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getArticle, updateArticle, deleteArticle, ArticleNotFoundError, ArticleGroupNotFoundError } from "@/lib/services/article.service";
import { ok, err, unauthorized } from "@/lib/utils/api-response";

function ua(e: unknown) {
  if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized();
  return null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const s = await requireAuth(); const { id } = await params;
    const a = await getArticle(id, s.userId);
    if (!a) return err("NOT_FOUND", "文章不存在", undefined, 404);
    return ok(a);
  } catch (e) { return ua(e) ?? err("INTERNAL_ERROR", "服务器内部错误", undefined, 500); }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const s = await requireAuth(); const { id } = await params; const body = await req.json();
    return ok(await updateArticle(id, s.userId, body), "文章更新成功");
  } catch (e) { if (e instanceof ArticleNotFoundError || e instanceof ArticleGroupNotFoundError) return err("NOT_FOUND", e.message, undefined, 404);
    return ua(e) ?? err("INTERNAL_ERROR", "服务器内部错误", undefined, 500); }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try { const s = await requireAuth(); const { id } = await params;
    await deleteArticle(id, s.userId); return ok({}, "文章已删除");
  } catch (e) { if (e instanceof ArticleNotFoundError) return err("NOT_FOUND", e.message, undefined, 404);
    return ua(e) ?? err("INTERNAL_ERROR", "服务器内部错误", undefined, 500); }
}
