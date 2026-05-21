import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { importFromPaste, importFromUrl, importFromThirdParty, DuplicateMaterialError, ValidationError } from "@/lib/services/material-import.service";
import { ok, err, unauthorized } from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();
    const source = body.source as string;

    if (source === "third_party") {
      try { importFromThirdParty(); } catch (e) { return err("THIRD_PARTY_UNAVAILABLE", (e as Error).message); }
    }

    if (source === "url") {
      const article = await importFromUrl(session.userId, {
        url: body.url as string,
        domainId: body.domainId as string,
        title: body.title as string | undefined,
        platform: body.platform as string | undefined,
      });
      return ok(article);
    }

    const article = await importFromPaste(session.userId, {
      title: body.title as string,
      content: body.content as string,
      domainId: body.domainId as string,
      sourceUrl: body.sourceUrl as string | undefined,
      platform: body.platform as string | undefined,
      summary: body.summary as string | undefined,
    });
    return ok(article);
  } catch (e) {
    if (e instanceof ValidationError) return err("VALIDATION_ERROR", e.message, undefined, 400);
    if (e instanceof DuplicateMaterialError) return err("DUPLICATE", e.message, undefined, 409);
    if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized();
    return err("INTERNAL_ERROR", "导入失败", undefined, 500);
  }
}
