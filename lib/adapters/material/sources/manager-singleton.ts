/**
 * Phase 24: ContentSourceManager singleton.
 * Shared instance used by both the API routes and the content worker.
 */
import { ContentSourceManager, RSSContentSource, NewRankContentSource } from "./index";

let _manager: ContentSourceManager | null = null;

export function getManager(): ContentSourceManager {
  if (_manager) return _manager;

  _manager = new ContentSourceManager();

  // Register RSS source (always enabled, unless CONTENT_SOURCES explicitly excludes it)
  const sources = process.env.CONTENT_SOURCES ?? "rss";
  if (sources.includes("rss")) {
    _manager.register(new RSSContentSource(true));
  }
  if (sources.includes("newrank")) {
    _manager.register(new NewRankContentSource(!!process.env.NEWRANK_API_KEY));
  }

  return _manager;
}

/** Reset singleton (for tests) */
export function resetManager(): void {
  _manager = null;
}
