import "dotenv/config";
import { describe, it, expect } from "vitest";

describe("GET /api/health", () => {
  it("returns 200 with ok=true when DB is connected", async () => {
    const { GET } = await import("../app/api/health/route.js");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.database).toBe("ok");
    expect(body.timestamp).toBeTruthy();
  });
});
