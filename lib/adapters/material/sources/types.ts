/**
 * Phase 24: ContentSource interface and types.
 * Each source fetches articles from an external provider.
 */
export interface ContentSourceArticle {
  /** Article title (required) */
  title: string;
  /** Original URL */
  sourceUrl: string;
  /** Publish date (falls back to now if unknown) */
  publishedAt: Date;

  /** Full article text (may be truncated for RSS) */
  fullContent?: string;
  /** Summary or snippet */
  summary?: string;

  /** Engagement metrics (RSS won't have these) */
  readCount?: number;
  likeCount?: number;
  commentCount?: number;

  /** Platform: wechat / xiaohongshu / zhihu / website etc. */
  platform: string;

  /** Hint for matching MaterialDomain.name (fuzzy match) */
  domainHint?: string;

  /** Account linkage */
  accountName?: string;
  accountExternalId?: string;
}

export interface ContentSourceHealth {
  name: string;
  status: "ok" | "degraded" | "error";
  lastFetchAt?: Date;
  lastArticleCount?: number;
  errorMessage?: string;
}

export interface ContentSourceFetchResult {
  source: string;
  articlesFound: number;
  articlesNew: number;
  articlesDuplicated: number;
  errors: string[];
}

export interface ContentSource {
  /** Unique source identifier (e.g. "rss", "newrank") */
  readonly name: string;
  /** Human-readable description */
  readonly description: string;
  /** Whether this source is active */
  readonly isEnabled: boolean;

  /** Fetch recently published articles */
  fetchRecent(): Promise<ContentSourceArticle[]>;
  /** Quick health probe */
  healthCheck(): Promise<ContentSourceHealth>;
}
