"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type Article = { id: string; title: string | null; status: string; pushStatus: string; group: { name: string } | null; prompt: { name: string } | null; updatedAt: string };

export function ArticleList({
  refreshKey, statusFilter, groupId,
  onStatusChange, onGroupChange, onRefresh,
}: { refreshKey: number; statusFilter: string; groupId: string; onStatusChange: (s: string) => void; onGroupChange: (g: string) => void; onRefresh: () => void }) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => { fetch("/api/article/groups", { credentials: "include" }).then(r => r.json()).then(b => { if (b.success) setGroups(b.data); }); }, []);

  useEffect(() => {
    let c = false;
    async function load() {
      setLoading(true);
      const p = new URLSearchParams(); if (statusFilter) p.set("status", statusFilter); if (groupId) p.set("groupId", groupId);
      if (keyword) p.set("keyword", keyword); p.set("page", String(page)); p.set("pageSize", "20");
      const r = await fetch(`/api/articles?${p}`, { credentials: "include" }); const b = await r.json();
      if (!c) { if (b.success) { setArticles(b.data.items); setTotal(b.data.total); } setLoading(false); }
    }
    load(); return () => { c = true; };
  }, [refreshKey, statusFilter, groupId, keyword, page]);

  async function handleDelete(id: string) {
    if (!confirm("确定删除？")) return;
    await fetch(`/api/articles/${id}`, { method: "DELETE", credentials: "include" }); onRefresh();
  }

  const statuses = ["", "generating", "completed", "failed"];
  const labels: Record<string, string> = { "": "全部", "generating": "创作中", "completed": "已完成", "failed": "失败" };

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4 items-center">
        {statuses.map(s => (
          <button key={s} onClick={() => { onStatusChange(s); setPage(1); }}
            className={`glass-pill text-xs ${statusFilter === s ? "glass-pill-active" : ""}`}>{labels[s]}</button>
        ))}
        <select value={groupId} onChange={e => { onGroupChange(e.target.value); setPage(1); }}
          className="glass-input !py-1.5 !text-xs !px-3 !rounded-full">
          <option value="">全部分组</option>{groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}</select>
        <input type="text" value={keyword} onChange={e => { setKeyword(e.target.value); setPage(1); }}
          placeholder="搜索..." className="glass-input !py-1.5 !text-xs !px-3 !rounded-full" />
      </div>

      {loading && <p className="text-sm text-zinc-400 py-8">加载中...</p>}
      {!loading && articles.length === 0 && <p className="text-sm text-zinc-400 py-8">暂无文章</p>}

      {!loading && articles.length > 0 && <div className="space-y-2.5">
        {articles.map(a => (
          <div key={a.id} data-testid={`article-row-${a.id}`} className="glass-tile p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="font-medium text-zinc-900 truncate">{a.title || "未命名文章"}</h3>
              <p className="text-xs text-zinc-400 mt-0.5">{a.group?.name ?? "未分组"} · {a.prompt?.name ?? "无提示词"} · {new Date(a.updatedAt).toLocaleDateString()}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span data-testid={`article-status-${a.id}`} className={a.status === "completed" ? "badge-ok" : a.status === "failed" ? "badge-err" : a.status === "generating" ? "badge-info" : "badge-muted"}>{labels[a.status] ?? a.status}</span>
              <Link href={`/formatter?articleId=${a.id}`} className="text-xs text-zinc-400 hover:text-zinc-600">排版</Link>
              <button onClick={() => handleDelete(a.id)} className="text-xs text-red-400 hover:text-red-600">删除</button>
            </div>
          </div>
        ))}
      </div>}

      {total > 20 && <div className="flex items-center justify-between mt-4 text-sm text-zinc-500">
        <span>共 {total} 条</span>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="glass-pill text-xs disabled:opacity-30">上一页</button>
          <span className="px-3 py-1">{page} / {Math.ceil(total / 20)}</span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)} className="glass-pill text-xs disabled:opacity-30">下一页</button>
        </div>
      </div>}
    </div>
  );
}
