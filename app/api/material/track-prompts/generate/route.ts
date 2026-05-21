import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { createTrackPromptJob } from "@/lib/services/material-track-prompt.service";
import { enqueuePromptGeneration } from "@/lib/queue";
import { ok, err, unauthorized } from "@/lib/utils/api-response";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await req.json();

    const job = await createTrackPromptJob(session.userId, {
      domainId: body.domainId as string,
      articleIds: body.articleIds as string[],
      name: body.name as string,
      targetAudience: body.targetAudience as string,
      authorPersona: body.authorPersona as string,
      userNotes: body.userNotes as string | undefined,
      groupId: body.groupId as string | null | undefined,
    });

    await enqueuePromptGeneration(job.id);
    return ok({ jobId: job.id, status: job.status });
  } catch (e) {
    if (e instanceof Error && e.message && (e.message.includes("至少需要") || e.message.includes("最多只能") || e.message.includes("不存在") || e.message.includes("没有全文"))) {
      return err("VALIDATION_ERROR", e.message, undefined, 400);
    }
    if (e instanceof Error && (e as { code?: string }).code === "UNAUTHORIZED") return unauthorized();
    return err("INTERNAL_ERROR", "创建失败", undefined, 500);
  }
}
