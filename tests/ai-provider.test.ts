/**
 * Phase 19: AI Provider unit tests.
 * All tests use vi.fn() to mock fetch — no real network calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OpenAICompatibleProvider } from "../lib/adapters/ai/openai-provider.js";
import { MockAIProvider } from "../lib/adapters/ai/mock-provider.js";
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
    it("runs strategy, draft, human rewrite, and quality stages", async () => {
      const draftArticle: GenerateArticleResult = {
        ...articleResult,
        title: "初稿标题",
        markdown: "# 初稿标题\n\n这里是第一版正文。",
      };
      const finalArticle: GenerateArticleResult = {
        ...articleResult,
        title: "终稿标题",
        markdown: "# 终稿标题\n\n这里是改写后的正文，比初稿更像真人表达。",
        draftMarkdown: draftArticle.markdown,
        humanizationReport: {
          writingMode: "viral_deep",
          strategySummary: ["从读者痛点切入"],
          humanizationEdits: ["删掉模板化连接词"],
          materialUsage: ["只使用已给素材"],
          originalityChecks: ["没有照抄爆款表达"],
          riskNotes: ["未核实的数据需删除"],
          aiLikeRisk: "low",
          genericPhrases: [],
          weakParagraphs: [],
          concreteDetailsCount: 3,
          rhythmIssues: [],
          rewriteNotes: ["保留读者场景"],
        },
      };
      mockFetchResponse({
        choices: [{ message: { content: JSON.stringify({ angle: "读者痛点", structure: ["开头", "正文", "结尾"], riskNotes: [] }) } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      });
      mockFetchResponse({
        choices: [{ message: { content: JSON.stringify(draftArticle) } }],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      });
      mockFetchResponse({
        choices: [{ message: { content: JSON.stringify({ ...finalArticle, riskNotes: ["素材真实性已标注"] }) } }],
        usage: { prompt_tokens: 30, completion_tokens: 15, total_tokens: 45 },
      });
      mockFetchResponse({
        choices: [{ message: { content: JSON.stringify(finalArticle) } }],
        usage: { prompt_tokens: 200, completion_tokens: 100, total_tokens: 300 },
      });
      const { result, usage } = await makeProvider().generateArticle({
        title: "test", promptContent: "", materialAnalysisJson: "{}",
        referenceUrls: [], materialText: "", wordCount: 500,
        imageCount: 0, imageStrategy: "none", headingStyle: "numbered",
        enableAIDetectionEvasion: false, writingMode: "viral_deep",
      });
      expect(fetch).toHaveBeenCalledTimes(4);
      const payloadText = vi.mocked(fetch).mock.calls
        .map(([, init]) => JSON.stringify(JSON.parse((init as RequestInit).body as string).messages))
        .join("\n");
      expect(payloadText).toContain("策略");
      expect(payloadText).toContain("初稿");
      expect(payloadText).toContain("人味改写");
      expect(payloadText).toContain("质检");
      expect(payloadText).toContain("不要伪造经历或数据");
      expect(payloadText).toContain("不要照抄爆款");
      expect(payloadText).not.toContain("绕过检测");
      expect(result.title).toBe("终稿标题");
      expect(result.draftMarkdown).toBe(draftArticle.markdown);
      expect(result.markdown).not.toBe(result.draftMarkdown);
      expect(result.humanizationReport?.writingMode).toBe("viral_deep");
      expect(usage.totalTokens).toBe(390);
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

describe("MockAIProvider article modes", () => {
  it("keeps quick mode compatible with the old result shape", async () => {
    const provider = new MockAIProvider();
    const { result } = await provider.generateArticle({
      title: "快速文章", promptContent: "", materialAnalysisJson: "{}",
      referenceUrls: [], materialText: "", wordCount: 500,
      imageCount: 0, imageStrategy: "none", headingStyle: "numbered",
      enableAIDetectionEvasion: false,
    });

    expect(result.markdown).toContain("# 快速文章");
    expect(result.draftMarkdown).toBeUndefined();
    expect(result.humanizationReport).toBeUndefined();
  });

  it.each(["material_based", "viral_deep", "humanized"] as const)(
    "returns draft and report for %s mode",
    async (writingMode) => {
      const provider = new MockAIProvider();
      const { result } = await provider.generateArticle({
        title: "深度文章", promptContent: "", materialAnalysisJson: "{}",
        referenceUrls: [], materialText: "用户给出的真实素材", wordCount: 1200,
        imageCount: 0, imageStrategy: "none", headingStyle: "numbered",
        enableAIDetectionEvasion: false, writingMode,
      });

      expect(result.draftMarkdown).toContain("# 深度文章");
      expect(result.markdown).toContain("# 深度文章");
      expect(result.markdown).not.toBe(result.draftMarkdown);
      expect(result.humanizationReport?.writingMode).toBe(writingMode);
      expect(result.humanizationReport?.riskNotes.join("")).toContain("核实");
    },
  );
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

  it("defaults to mock and does not call real AI for article generation", async () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("AI_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn());
    const { createConfiguredProvider } = await import("../lib/adapters/ai/openai-provider.js");
    const p = await createConfiguredProvider();
    const { result } = await p.generateArticle({
      title: "默认 Mock", promptContent: "", materialAnalysisJson: "{}",
      referenceUrls: [], materialText: "", wordCount: 500,
      imageCount: 0, imageStrategy: "none", headingStyle: "numbered",
      enableAIDetectionEvasion: false,
    });
    expect(result.markdown).toContain("# 默认 Mock");
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});
