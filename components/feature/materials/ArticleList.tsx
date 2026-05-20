"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

type Article = {
  id: string;
  platform: string;
  title: string;
  sourceUrl: string | null;
  summary: string | null;
  coverUrl: string | null;
  readCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string | null;
};

export function ArticleList() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");

  const pageSize = 20;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (keyword) params.set("keyword", keyword);
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        const res = await fetch(`/api/material/articles?${params}`);
        const body = await res.json();
        if (cancelled) return;
        if (!body.success) {
          setError(body.error?.message ?? "加载失败");
          return;
        }
        setArticles(body.data.items);
        setTotal(body.data.total);
      } catch {
        if (!cancelled) setError("网络错误");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [page, keyword]);

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900 mb-4">文章素材</h2>

      <div className="mb-4">
        <input
          type="text"
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
          placeholder="搜索文章标题..."
          className="glass-input text-sm"
        />
      </div>

      {loading && <p className="text-sm text-zinc-400 py-8">加载中...</p>}
      {error && <p className="text-sm text-red-500 py-8">{error}</p>}
      {!loading && !error && articles.length === 0 && (
        <p className="text-sm text-zinc-400 py-8">暂无文章数据</p>
      )}

      {!loading && !error && articles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {articles.map((a) => (
            <div key={a.id} className="glass-card p-4">
              {a.coverUrl && (
                <Image src={a.coverUrl} alt="" width={400} height={200} className="w-full h-32 object-cover rounded-xl mb-3" />
              )}
              <h3 className="font-medium text-zinc-900 line-clamp-2">{a.title}</h3>
              {a.summary && (
                <p className="mt-1 text-xs text-zinc-500 line-clamp-2">{a.summary}</p>
              )}
              <div className="mt-2 flex items-center gap-3 text-xs text-zinc-400">
                <span>{a.platform}</span>
                <span>阅读 {a.readCount.toLocaleString()}</span>
                <span>赞 {a.likeCount.toLocaleString()}</span>
                {a.publishedAt && <span>{new Date(a.publishedAt).toLocaleDateString()}</span>}
              </div>
              {a.sourceUrl && (
                <a
                  href={a.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block text-xs text-zinc-400 hover:text-zinc-600 truncate"
                >
                  查看原文
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {total > pageSize && (
        <div className="flex items-center justify-between mt-6 text-sm text-zinc-500">
          <span>共 {total} 条</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="glass-pill px-4 py-1.5 text-xs disabled:opacity-30"
            >
              上一页
            </button>
            <span className="px-3 py-1">{page} / {Math.ceil(total / pageSize)}</span>
            <button
              disabled={page >= Math.ceil(total / pageSize)}
              onClick={() => setPage((p) => p + 1)}
              className="glass-pill px-4 py-1.5 text-xs disabled:opacity-30"
            >
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
