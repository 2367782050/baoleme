import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import {
  addFavorite,
  removeFavorite,
  listFavorites,
  DuplicateFavoriteError,
  FavoriteNotFoundError,
} from "@/lib/services/material.service";
import { ok, err, unauthorized } from "@/lib/utils/api-response";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const params = req.nextUrl.searchParams;
    const targetType = (params.get("targetType") as "account" | "article" | "topic" | "prompt") ?? undefined;

    const favorites = await listFavorites(session.userId, targetType);
    return ok(favorites);
  } catch (e) {
    if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") {
      return unauthorized();
    }
    return err("INTERNAL_ERROR", "服务器内部错误", undefined, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    const { targetType, targetId } = body;
    if (!targetType || !targetId) {
      return err("VALIDATION_ERROR", "targetType 和 targetId 不能为空");
    }

    if (!["account", "article", "topic", "prompt"].includes(targetType)) {
      return err("VALIDATION_ERROR", "targetType 无效");
    }

    const fav = await addFavorite(session.userId, targetType, targetId);
    return ok(fav);
  } catch (e) {
    if (e instanceof DuplicateFavoriteError) {
      return err("DUPLICATE_FAVORITE", e.message, undefined, 409);
    }
    if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") {
      return unauthorized();
    }
    return err("INTERNAL_ERROR", "服务器内部错误", undefined, 500);
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

    await removeFavorite(id, session.userId);
    return ok({}, "已取消收藏");
  } catch (e) {
    if (e instanceof FavoriteNotFoundError) {
      return err("NOT_FOUND", e.message, undefined, 404);
    }
    if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") {
      return unauthorized();
    }
    return err("INTERNAL_ERROR", "服务器内部错误", undefined, 500);
  }
}
