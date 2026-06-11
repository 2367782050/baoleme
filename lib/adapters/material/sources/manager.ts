/**
 * Phase 24: ContentSourceManager — orchestrates all content sources.
 * Handles registration, health aggregation, and batch fetching.
 */
import type { ContentSource, ContentSourceHealth, ContentSourceFetchResult } from "./types";

export class ContentSourceManager {
  private sources = new Map<string, ContentSource>();

  register(source: ContentSource): void {
    if (this.sources.has(source.name)) {
      throw new Error(`Source "${source.name}" already registered`);
    }
    this.sources.set(source.name, source);
  }

  getSource(name: string): ContentSource | undefined {
    return this.sources.get(name);
  }

  listSources(): ContentSource[] {
    return [...this.sources.values()];
  }

  async getHealth(): Promise<ContentSourceHealth[]> {
    const results = await Promise.allSettled(
      [...this.sources.values()].map(async (s) => {
        try {
          return await s.healthCheck();
        } catch (e) {
          return {
            name: s.name,
            status: "error" as const,
            errorMessage: `Health check threw: ${(e as Error).message}`,
          };
        }
      }),
    );

    return results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return {
        name: [...this.sources.values()][i]?.name ?? "unknown",
        status: "error" as const,
        errorMessage: `Health check failed: ${r.reason}`,
      };
    });
  }

  async fetchSource(name: string): Promise<ContentSourceFetchResult> {
    const source = this.sources.get(name);
    if (!source) {
      throw new Error(`Source "${name}" not found`);
    }
    if (!source.isEnabled) {
      return {
        source: name,
        articlesFound: 0,
        articlesNew: 0,
        articlesDuplicated: 0,
        errors: ["Source is disabled"],
      };
    }

    return this.executeFetch(source);
  }

  async fetchAllEnabled(): Promise<ContentSourceFetchResult[]> {
    const enabled = [...this.sources.values()].filter((s) => s.isEnabled);
    const results = await Promise.allSettled(
      enabled.map((s) => this.executeFetch(s)),
    );

    return results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return {
        source: enabled[i]?.name ?? "unknown",
        articlesFound: 0,
        articlesNew: 0,
        articlesDuplicated: 0,
        errors: [`Fetch threw: ${r.reason}`],
      };
    });
  }

  private async executeFetch(source: ContentSource): Promise<ContentSourceFetchResult> {
    const errors: string[] = [];
    let articlesFound = 0;
    let articlesNew = 0;
    let articlesDuplicated = 0;

    try {
      const articles = await source.fetchRecent();
      articlesFound = articles.length;

      // Dynamically import to avoid circular dependency
      const { importContentSourceArticle } = await import(
        "@/lib/services/content-ingestion.service"
      );

      for (const article of articles) {
        try {
          const result = await importContentSourceArticle(article);
          if (result.status === "new") articlesNew++;
          else articlesDuplicated++;
        } catch (e) {
          errors.push(`Article "${article.title}": ${(e as Error).message}`);
        }
      }
    } catch (e) {
      errors.push(`Source fetch failed: ${(e as Error).message}`);
    }

    return {
      source: source.name,
      articlesFound,
      articlesNew,
      articlesDuplicated,
      errors,
    };
  }
}
