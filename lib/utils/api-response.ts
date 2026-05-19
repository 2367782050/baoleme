import { NextResponse } from "next/server";

export function ok(data: unknown, message?: string) {
  return NextResponse.json({ success: true, data, message: message ?? "" });
}

export function err(code: string, message: string, details?: unknown, status: number = 400) {
  return NextResponse.json(
    {
      success: false,
      error: { code, message, ...(details ? { details } : {}) },
    },
    { status },
  );
}

export function unauthorized(message = "未登录") {
  return err("UNAUTHORIZED", message, undefined, 401);
}

export function forbidden(message = "无权限") {
  return err("FORBIDDEN", message, undefined, 403);
}

export function notFound(message = "未找到") {
  return err("NOT_FOUND", message, undefined, 404);
}

export function validationError(message: string, details?: unknown) {
  return err("VALIDATION_ERROR", message, details, 400);
}

export function quotaExceeded(message: string) {
  return err("QUOTA_EXCEEDED", message, undefined, 403);
}
