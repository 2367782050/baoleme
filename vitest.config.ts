import { defineConfig } from "vitest/config";
import path from "node:path";
import "dotenv/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 15000,
    hookTimeout: 30000,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    fileParallelism: false,
    sequence: {
      concurrent: false,
    },
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    env: {
      DATABASE_URL: process.env.DATABASE_URL!,
      AI_PROVIDER: "mock",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
