import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { renderMarkdown, DEFAULT_CONFIG } from "@/lib/services/formatter.service";
import { ok, err, unauthorized } from "@/lib/utils/api-response";

function ua(e: unknown) {
  if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized();
  return null;
}

/** Validate a numeric styling parameter. Returns parsed number or sends error. */
function getNumber(raw: unknown, dflt: number, label: string, min: number, max: number): number | Response {
  if (raw === undefined || raw === null) return dflt;
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return err("VALIDATION_ERROR", `${label} 必须是有效数字`);
  }
  if (raw < min || raw > max) {
    return err("VALIDATION_ERROR", `${label} 范围 ${min}-${max}`);
  }
  return raw;
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const body = await req.json();
    const markdown = body.markdown;

    if (typeof markdown !== "string") {
      return err("VALIDATION_ERROR", "markdown 不能为空");
    }

    const f = getNumber(body.fontSize, DEFAULT_CONFIG.fontSize, "字号", 12, 28);
    if (f instanceof Response) return f;
    const lh = getNumber(body.lineHeight, DEFAULT_CONFIG.lineHeight, "行距", 1.2, 4);
    if (lh instanceof Response) return lh;
    const ps = getNumber(body.paragraphSpacing, DEFAULT_CONFIG.paragraphSpacing, "段距", 0, 60);
    if (ps instanceof Response) return ps;
    const sp = getNumber(body.sidePadding, DEFAULT_CONFIG.sidePadding, "边距", 0, 60);
    if (sp instanceof Response) return sp;
    const ir = getNumber(body.imageRounded, DEFAULT_CONFIG.imageRounded, "圆角", 0, 30);
    if (ir instanceof Response) return ir;

    const config = {
      style: body.style ?? DEFAULT_CONFIG.style,
      themeColor: body.themeColor ?? DEFAULT_CONFIG.themeColor,
      fontFamily: body.fontFamily ?? DEFAULT_CONFIG.fontFamily,
      fontSize: f,
      lineHeight: lh,
      paragraphSpacing: ps,
      sidePadding: sp,
      imageRounded: ir,
      antiAI: body.antiAI ?? DEFAULT_CONFIG.antiAI,
    };

    const html = renderMarkdown(markdown, config);
    return ok({ html });
  } catch (e) {
    return ua(e) ?? err("INTERNAL_ERROR", "服务器内部错误", undefined, 500);
  }
}
