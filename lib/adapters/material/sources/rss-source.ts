/**
 * Phase 24: RSS Content Source.
 * Fetches articles from curated RSS/Atom feeds.
 */
import Parser from "rss-parser";
import { FEEDS } from "./feed-config";
import type { ContentSource, ContentSourceArticle, ContentSourceHealth } from "./types";

export interface FeedConfig {
  url: string;
  name: string;
  platform: string;
  domainHint: string;
  requestTimeoutMs?: number;
}

type CustomFeed = Record<string, unknown>;
type CustomItem = {
  title?: string;
  link?: string;
  isoDate?: string;
  pubDate?: string;
  contentSnippet?: string;
  content?: string;
  "content:encoded"?: string;
  creator?: string;
  author?: string;
};

export class RSSContentSource implements ContentSource {
  readonly name = "rss";
  readonly description = "RSS 订阅聚合（36氪、虎嗅、少数派等 ~20 源）";
  readonly isEnabled: boolean;

  private parser: Parser<CustomFeed, CustomItem>;
  private feedConfigs: FeedConfig[];

  constructor(enabled = true) {
    this.isEnabled = enabled;
    this.parser = new Parser<CustomFeed, CustomItem>({
      timeout: 15000,
      customFields: { item: ["content:encoded"] },
    });
    this.feedConfigs = FEEDS;
  }

  async fetchRecent(): Promise<ContentSourceArticle[]> {
    const results: ContentSourceArticle[] = [];
    for (const feed of this.feedConfigs) {
      try {
        const parsed = await this.parser.parseURL(feed.url);
        for (const item of parsed.items ?? []) {
          if (!item.title || !item.link) continue;
          results.push(this.mapItem(item, feed));
        }
      } catch (e) {
        console.error(`[rss] Failed ${feed.name}: ${(e as Error).message}`);
        // Continue with other feeds — graceful degradation
      }
    }
    return results;
  }

  async healthCheck(): Promise<ContentSourceHealth> {
    const results: { name: string; ok: boolean; count: number; error?: string }[] = [];
    for (const feed of this.feedConfigs) {
      try {
        const parsed = await this.parser.parseURL(feed.url);
        results.push({ name: feed.name, ok: true, count: parsed.items?.length ?? 0 });
      } catch (e) {
        results.push({ name: feed.name, ok: false, count: 0, error: (e as Error).message });
      }
    }

    const okCount = results.filter(r => r.ok).length;
    const total = results.length;
    const totalArticles = results.reduce((s, r) => s + r.count, 0);

    if (okCount === 0) {
      return {
        name: this.name,
        status: "error",
        errorMessage: `All ${total} feeds failed. First: ${results[0]?.error ?? "unknown"}`,
      };
    }
    if (okCount < total * 0.7) {
      return {
        name: this.name,
        status: "degraded",
        lastFetchAt: new Date(),
        lastArticleCount: totalArticles,
        errorMessage: `${total - okCount}/${total} feeds failed`,
      };
    }
    return {
      name: this.name,
      status: "ok",
      lastFetchAt: new Date(),
      lastArticleCount: totalArticles,
    };
  }

  private mapItem(item: CustomItem, feed: FeedConfig): ContentSourceArticle {
    // Prefer content:encoded (full HTML), fall back to content, then contentSnippet
    const fullContent =
      item["content:encoded"] ??
      item.content ??
      item.contentSnippet ??
      undefined;

    const summary = item.contentSnippet ?? item.content?.substring(0, 500);
    const author = item.creator ?? item.author;

    const publishedAt = item.isoDate
      ? new Date(item.isoDate)
      : item.pubDate
        ? new Date(item.pubDate)
        : new Date();

    return {
      title: item.title!,
      sourceUrl: item.link!,
      publishedAt,
      fullContent,
      summary,
      platform: feed.platform,
      domainHint: feed.domainHint,
      accountName: author ?? feed.name,
    };
  }
}
