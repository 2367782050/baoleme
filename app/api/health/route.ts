import { prisma } from "@/lib/db";

export async function GET() {
  let database = "ok";

  try {
    // Lightweight query: check DB connectivity.
    await prisma.$queryRaw`SELECT 1`;
  } catch (e) {
    database = (e as Error).message.substring(0, 200);
  }

  return Response.json({
    ok: database === "ok",
    database,
    timestamp: new Date().toISOString(),
  }, {
    status: database === "ok" ? 200 : 503,
  });
}
