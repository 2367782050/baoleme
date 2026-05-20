/**
 * Phase 19: AI Provider unit tests.
 * All tests use vi.fn() to mock fetch — no real network calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenAICompatibleProvider } from "../lib/adapters/ai/openai-provider.js";
import type { GeneratePromptResult, GenerateArticleResult } from "../lib/adapters/ai/types.js";

const BASE_URL = "https://api.test.com/v1";
const API_KEY = "test-key";
const MODEL = "test-model";

function makeProvider(timeoutMs?: number) {
  return new OpenAICompatibleProvider({ baseUrl: BASE_URL, apiKey: API_KEY, model: MODEL, timeoutMs });
}

function mockFetchResponse(body: unknown, status = 200) {
  vi.mocked(fetch).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response);
}

const promptResult: GeneratePromptResult = {
  name: "测试提示词", summary: "这是测试",
  content: "这是提示词正文，包含足够的中文内容用于测试验证。",
  recommendedInputs: [], titleRules: [], structureRules: [], styleRules: [], materialRules: [], forbiddenRules: [],
};

const articleResult: GenerateArticleResult = {
  title: "测试文章", excerpt: "摘要",
  markdown: "# 测试\n\n这是测试文章正文，包含足够的中文内容。\n\n## 第一节\n\n内容段落。",
  imageSlots: [], coverPrompt: "", riskNotes: [],
};

vi.mock("node:fs"); // prevent accidental FS access

describe("OpenAICompatibleProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("generatePrompt", () => {
    it("returns parsed JSON on success", async () => {
      mockFetchResponse({
        choices: [{ message: { content: JSON.stringify(promptResult) } }],
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
      });
      const p = makeProvider();
      const { result, usage } = await p.generatePrompt({
        name: "test", contentDomain: "财经", targetAudience: "读者",
        authorName: "作者", personaDetails: "", personalityTraits: [], headingStyle: "numbered",
        wordCount: 1000, enableAIDetectionEvasion: false, materialAnalysisJson: "{}", userNotes: "",
      });
      expect(result.name).toBe("测试提示词");
      expect(usage.totalTokens).toBe(150);
    });

    it("throws Chinese error on HTTP 500", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500, text: async () => "Internal Error" } as Response);
      const p = makeProvider();
      await expect(p.generatePrompt({
        name: "t", contentDomain: "财经", targetAudience: "读",
        authorName: "a", personaDetails: "", personalityTraits: [], headingStyle: "numbered",
        wordCount: 100, enableAIDetectionEvasion: false, materialAnalysisJson: "{}", userNotes: "",
      })).rejects.toThrow("AI 服务暂时不可用");
    });

    it("throws Chinese error on HTTP 401", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 401, text: async () => "Unauthorized" } as Response);
      await expect(makeProvider().generatePrompt({
        name: "t", contentDomain: "财经", targetAudience: "读",
        authorName: "a", personaDetails: "", personalityTraits: [], headingStyle: "numbered",
        wordCount: 100, enableAIDetectionEvasion: false, materialAnalysisJson: "{}", userNotes: "",
      })).rejects.toThrow("AI 认证失败");
    });

    it("throws Chinese error on timeout", async () => {
      vi.mocked(fetch).mockImplementationOnce(() => {
        const err = new Error("aborted") as Error & { name: string };
        err.name = "AbortError";
        return Promise.reject(err);
      });
      await expect(makeProvider(500).generatePrompt({
        name: "t", contentDomain: "财经", targetAudience: "读",
        authorName: "a", personaDetails: "", personalityTraits: [], headingStyle: "numbered",
        wordCount: 100, enableAIDetectionEvasion: false, materialAnalysisJson: "{}", userNotes: "",
      })).rejects.toThrow("AI 调用超时");
    });

    it("throws Chinese error on empty choices", async () => {
      mockFetchResponse({ choices: [], usage: {} });
      await expect(makeProvider().generatePrompt({
        name: "t", contentDomain: "财经", targetAudience: "读",
        authorName: "a", personaDetails: "", personalityTraits: [], headingStyle: "numbered",
        wordCount: 100, enableAIDetectionEvasion: false, materialAnalysisJson: "{}", userNotes: "",
      })).rejects.toThrow("AI 未返回有效结果");
    });

    it("throws Chinese error on invalid JSON", async () => {
      mockFetchResponse({ choices: [{ message: { content: "这不是合法的JSON字符串" } }], usage: {} });
      await expect(makeProvider().generatePrompt({
        name: "t", contentDomain: "财经", targetAudience: "读",
        authorName: "a", personaDetails: "", personalityTraits: [], headingStyle: "numbered",
        wordCount: 100, enableAIDetectionEvasion: false, materialAnalysisJson: "{}", userNotes: "",
      })).rejects.toThrow("AI 返回格式异常");
    });
  });

  describe("generateArticle", () => {
    it("returns parsed JSON on success", async () => {
      mockFetchResponse({
        choices: [{ message: { content: JSON.stringify(articleResult) } }],
        usage: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
      });
      const { result, usage } = await makeProvider().generateArticle({
        title: "test", promptContent: "", materialAnalysisJson: "{}",
        referenceUrls: [], materialText: "", wordCount: 500,
        imageCount: 0, imageStrategy: "none", headingStyle: "numbered",
        enableAIDetectionEvasion: false,
      });
      expect(result.title).toBe("测试文章");
      expect(usage.totalTokens).toBe(300);
    });

    it("throws Chinese error on HTTP 500", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 503, text: async () => "Service Unavailable" } as Response);
      await expect(makeProvider().generateArticle({
        title: "t", promptContent: "", materialAnalysisJson: "{}",
        referenceUrls: [], materialText: "", wordCount: 100,
        imageCount: 0, imageStrategy: "none", headingStyle: "numbered",
        enableAIDetectionEvasion: false,
      })).rejects.toThrow("AI 服务暂时不可用");
    });
  });

  describe("analyzeMaterial", () => {
    it("throws Chinese error on failure", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500, text: async () => "error" } as Response);
      await expect(makeProvider().analyzeMaterial({
        contentDomain: "财经", targetAudience: "读", sourceType: "text", materialText: "test",
      })).rejects.toThrow("AI 服务暂时不可用");
    });
  });
});

describe("createConfiguredProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns mock when AI_PROVIDER=mock", async () => {
    vi.stubEnv("AI_PROVIDER", "mock");
    vi.stubEnv("AI_API_KEY", "sk-real");
    const { createConfiguredProvider } = await import("../lib/adapters/ai/openai-provider.js");
    const p = await createConfiguredProvider();
    // Mock provider generates a prompt without calling fetch
    const { result } = await p.generatePrompt({
      name: "t", contentDomain: "财经", targetAudience: "读",
      authorName: "a", personaDetails: "", personalityTraits: [], headingStyle: "numbered",
      wordCount: 100, enableAIDetectionEvasion: false, materialAnalysisJson: "{}", userNotes: "",
    });
    expect(result.content).toBeTruthy();
    vi.unstubAllEnvs();
  });

  it("returns mock when AI_API_KEY is missing", async () => {
    vi.stubEnv("AI_PROVIDER", "openai-compatible");
    vi.stubEnv("AI_API_KEY", "");
    const { createConfiguredProvider } = await import("../lib/adapters/ai/openai-provider.js");
    const p = await createConfiguredProvider();
    expect(p).toBeTruthy();
    vi.unstubAllEnvs();
  });
});
