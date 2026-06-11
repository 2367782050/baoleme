/**
 * Phase 24: NewRank (新榜) Content Source.
 * Provides real WeChat article data with engagement metrics.
 * Self-disables when NEWRANK_API_KEY is not configured.
 */
import type { ContentSource, ContentSourceArticle, ContentSourceHealth } from "./types";

export class NewRankContentSource implements ContentSource {
  readonly name = "newrank";
  readonly description = "新榜 API — 真实微信公众号文章数据（需 API Key）";
  readonly isEnabled: boolean;

  private apiKey: string | null;

  constructor(enabled = false) {
    this.apiKey = process.env.NEWRANK_API_KEY ?? null;
    this.isEnabled = enabled && this.apiKey !== null;
  }

  async fetchRecent(): Promise<ContentSourceArticle[]> {
    if (!this.apiKey) {
      throw new Error("NEWRANK_API_KEY not configured");
    }

    // TODO: Real NewRank API integration
    // - Endpoint: POST https://api.newrank.cn/api/...
    // - Auth: API Key in header
    // - Map response to ContentSourceArticle with real readCount/likeCount/commentCount
    // - This provides the "低粉高阅读" signal that RSS alone cannot

    console.warn("[newrank] Real API not yet implemented. Set NEWRANK_API_KEY to enable.");
    return [];
  }

  async healthCheck(): Promise<ContentSourceHealth> {
    if (!this.apiKey) {
      return {
        name: this.name,
        status: "error",
        errorMessage: "API Key 未配置",
      };
    }

    try {
      // TODO: Real API health probe
      return {
        name: this.name,
        status: "degraded",
        errorMessage: "真实 API 待实现（已有 Key）",
      };
    } catch (e) {
      return {
        name: this.name,
        status: "error",
        errorMessage: `健康检查失败: ${(e as Error).message}`,
      };
    }
  }
}
