"use client";

import { useState, useEffect } from "react";

type SourceStatus = {
  name: string;
  enabled: boolean;
  description: string;
};

type SourceHealth = {
  name: string;
  status: "ok" | "degraded" | "error";
  lastFetchAt?: string;
  lastArticleCount?: number;
  errorMessage?: string;
};

type IngestionRun = {
  id: string;
  source: string;
  status: string;
  articlesFound: number;
  articlesNew: number;
  articlesDup: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
};

export function ContentSourcePanel() {
  const [sources, setSources] = useState<SourceStatus[]>([]);
  const [health, setHealth] = useState<SourceHealth[]>([]);
  const [runs, setRuns] = useState<IngestionRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState<string | null>(null);
  const [result, setResult] = useState<{ source: string; articlesFound: number; articlesNew: number; articlesDuplicated: number; errors: string[] } | null>(null);

  // Domain list for quick import
  const [domains, setDomains] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("/api/admin/content-sources");
        const b = await r.json();
        if (!cancelled && b.success) {
          setSources(b.data.sources ?? []);
          setHealth(b.data.health ?? []);
          setRuns(b.data.recentRuns ?? []);
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    // Load domains for quick import
    fetch("/api/material/domains").then(r => r.json()).then(b => {
      if (b.success) setDomains(b.data);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/content-sources");
      const b = await r.json();
      if (b.success) {
        setSources(b.data.sources ?? []);
        setHealth(b.data.health ?? []);
        setRuns(b.data.recentRuns ?? []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function handleFetch(source: string) {
    setFetching(source);
    setResult(null);
    try {
      const r = await fetch("/api/admin/content-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const b = await r.json();
      if (b.success) {
        setResult(b.data);
        refresh(); // refresh data
      }
    } catch { /* ignore */ }
    finally { setFetching(null); }
  }


  // Quick URL import
  const [quickUrl, setQuickUrl] = useState("");
  const [quickDomain, setQuickDomain] = useState("");
  const [quickImporting, setQuickImporting] = useState(false);
  const [quickResult, setQuickResult] = useState("");

  async function handleQuickImport(e: React.FormEvent) {
    e.preventDefault();
    if (!quickUrl || !quickDomain) return;
    setQuickImporting(true); setQuickResult("");
    try {
      const r = await fetch("/api/material/articles/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "url", url: quickUrl, domainId: quickDomain }),
      });
      const b = await r.json();
      if (b.success) {
        setQuickResult(`✅ 导入成功：${b.data.title}`);
        setQuickUrl("");
      } else {
        setQuickResult(`❌ ${b.error?.message ?? "导入失败"}`);
      }
    } catch {
      setQuickResult("❌ 网络错误");
    } finally { setQuickImporting(false); }
  }

  const statusDot = (s: string) => {
    switch (s) {
      case "ok": return <span className="w-2.5 h-2.5 rounded-full bg-green-400" />;
      case "degraded": return <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />;
      case "error": return <span className="w-2.5 h-2.5 rounded-full bg-red-400" />;
      default: return <span className="w-2.5 h-2.5 rounded-full bg-zinc-300" />;
    }
  };

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500">配置内容来源，自动获取真实的爆款文章素材。</p>

      {/* Quick URL import card */}
      <div className="glass-card p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-semibold text-zinc-900 mb-2">快捷链接采集</h3>
            <p className="text-sm text-zinc-500">
              看到一篇好文章，直接把链接贴进来，AI 自动抓取正文并归入对应赛道。
            </p>
          </div>
          <div className="shrink-0 text-3xl opacity-30">🔗</div>
        </div>
        <form onSubmit={handleQuickImport} className="flex gap-3">
          <select
            value={quickDomain}
            onChange={e => setQuickDomain(e.target.value)}
            required
            className="glass-input text-sm !py-2 shrink-0"
          >
            <option value="">选择赛道</option>
            {domains.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input
            value={quickUrl}
            onChange={e => setQuickUrl(e.target.value)}
            placeholder="粘贴文章链接 https://..."
            required
            className="glass-input text-sm flex-1"
          />
          <button type="submit" disabled={quickImporting} className="glass-btn-primary text-sm !px-4 shrink-0">
            {quickImporting ? "采集中..." : "采集"}
          </button>
        </form>
        {quickResult && (
          <p className={`mt-3 text-sm font-medium ${quickResult.startsWith("✅") ? "text-green-600" : "text-red-500"}`}>
            {quickResult}
          </p>
        )}
      </div>

      {/* Source list */}
      {loading && <p className="text-sm text-zinc-400">加载中...</p>}

      {!loading && sources.length === 0 && (
        <div className="glass-card p-8 text-center">
          <p className="text-zinc-400">暂无内容源。请设置 CONTENT_SOURCES 环境变量。</p>
        </div>
      )}

      {!loading && sources.map(source => {
        const h = health.find(x => x.name === source.name);
        return (
          <div key={source.name} className="glass-card p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {statusDot(h?.status ?? "ok")}
                <div>
                  <h3 className="font-semibold text-zinc-900 capitalize">{source.name}</h3>
                  <p className="text-xs text-zinc-500">{source.description}</p>
                </div>
              </div>
              <button
                onClick={() => handleFetch(source.name)}
                disabled={fetching !== null || !source.enabled}
                className="glass-btn-primary text-xs !py-1.5 !px-3"
              >
                {fetching === source.name ? "获取中..." : "立即获取"}
              </button>
            </div>

            {h && (
              <div className="mt-3 flex gap-4 text-xs text-zinc-500">
                {h.lastArticleCount !== undefined && <span>上次获取: {h.lastArticleCount} 篇</span>}
                {h.lastFetchAt && <span>{new Date(h.lastFetchAt).toLocaleString("zh-CN")}</span>}
                {h.errorMessage && <span className="text-red-500">{h.errorMessage}</span>}
              </div>
            )}
          </div>
        );
      })}

      {/* Fetch result toast */}
      {result && (
        <div className="glass-card p-4 bg-green-50/70 backdrop-blur">
          <p className="text-sm font-medium text-green-700">
            {result.source}: 发现 {result.articlesFound} 篇，新增 {result.articlesNew} 篇，重复 {result.articlesDuplicated} 篇
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 text-xs text-red-600 space-y-0.5">
              {result.errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* Ingestion history */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-zinc-900 mb-4">获取历史</h3>
        {runs.length === 0 && <p className="text-sm text-zinc-400">暂无记录</p>}
        {runs.length > 0 && (
          <div className="overflow-x-auto">
            <table className="glass-table w-full text-sm">
              <thead>
                <tr>
                  <th>来源</th>
                  <th>状态</th>
                  <th>发现</th>
                  <th>新增</th>
                  <th>重复</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(run => (
                  <tr key={run.id}>
                    <td className="capitalize">{run.source}</td>
                    <td>
                      <span className={run.status === "completed" ? "text-green-600" : run.status === "failed" ? "text-red-500" : "text-zinc-400"}>
                        {run.status === "completed" ? "完成" : run.status === "failed" ? "失败" : "运行中"}
                      </span>
                    </td>
                    <td>{run.articlesFound}</td>
                    <td className="text-green-600">{run.articlesNew}</td>
                    <td className="text-zinc-400">{run.articlesDup}</td>
                    <td className="text-zinc-400 text-xs">{new Date(run.createdAt).toLocaleString("zh-CN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Guide */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-zinc-900 mb-3">内容源说明</h3>
        <div className="space-y-3 text-sm text-zinc-600">
          <div className="flex gap-3">
            <span className="text-lg shrink-0">📡</span>
            <div>
              <p className="font-medium text-zinc-800">RSS 聚合</p>
              <p>从 36氪、虎嗅、华尔街见闻、创业邦等 ~20 个中文 RSS 源自动抓取最新文章。免费，开箱即用。</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-lg shrink-0">🤖</span>
            <div>
              <p className="font-medium text-zinc-800">AI 内容评分</p>
              <p>文章入库后，AI 自动分析标题病毒性、内容结构、情绪共鸣度，在没有互动数据时预测爆款潜力。</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="text-lg shrink-0">📊</span>
            <div>
              <p className="font-medium text-zinc-800">新榜 API（可选）</p>
              <p>对接新榜数据平台，获取真实微信公众号阅读量、点赞数等互动数据。需付费 API Key。配置后自动激活。</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
