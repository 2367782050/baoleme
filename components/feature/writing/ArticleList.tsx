"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useModal } from "@/components/ui/modal";

type Article = {
  id: string;
  title: string | null;
  status: string;
  pushStatus: string;
  group: { name: string } | null;
  prompt: { name: string } | null;
  updatedAt: string;
};

const STATUS_LABELS: Record<string, string> = {
  "": "全部",
  draft: "草稿",
  pending: "等待中",
  generating: "生产中",
  completed: "已完成",
  failed: "失败",
};

const PUSH_STATUS_LABELS: Record<string, string> = {
  not_pushed: "未推送",
  pending: "待推送",
  pushed: "已推送",
  failed: "推送失败",
};

function statusClass(status: string) {
  if (status === "completed") return "badge-ok";
  if (status === "failed") return "badge-err";
  if (status === "generating" || status === "pending") return "badge-info motion-generating";
  return "badge-muted";
}

export function ArticleList({
  refreshKey,
  statusFilter,
  groupId,
  onStatusChange,
  onGroupChange,
  onRefresh,
}: {
  refreshKey: number;
  statusFilter: string;
  groupId: string;
  onStatusChange: (status: string) => void;
  onGroupChange: (groupId: string) => void;
  onRefresh: () => void;
}) {
  const [articles, setArticles] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [notice, setNotice] = useState("");
  const modal = useModal();

  useEffect(() => {
    fetch("/api/article/groups", { credentials: "include" })
      .then((res) => res.json())
      .then((body) => {
        if (body.success) setGroups(body.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (groupId) params.set("groupId", groupId);
      if (keyword) params.set("keyword", keyword);
      params.set("page", String(page));
      params.set("pageSize", "20");
      try {
        const res = await fetch(`/api/articles?${params}`, { credentials: "include" });
        const body = await res.json();
        if (cancelled) return;
        if (!body.success) {
          setError(body.error?.message ?? "文章列表加载失败。");
          return;
        }
        setArticles(body.data.items);
        setTotal(body.data.total);
      } catch {
        if (!cancelled) setError("网络异常，文章列表加载失败。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey, statusFilter, groupId, keyword, page]);

  async function handleDelete(id: string) {
    const confirmed = await modal.open({
      title: "删除文章",
      message: "确定删除这篇文章？删除后无法恢复。",
      confirmLabel: "删除",
      variant: "danger",
    });
    if (!confirmed) return;
    await fetch(`/api/articles/${id}`, { method: "DELETE", credentials: "include" });
    onRefresh();
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="border-b border-black/5 p-4">
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-zinc-900">文章生产列表</h2>
            <p className="text-xs text-zinc-400">共 {total} 篇文章，支持按状态、分组和关键词筛选。</p>
          </div>
          {notice && <p className="rounded-full bg-white/70 px-3 py-1 text-xs text-zinc-500">{notice}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {["", "generating", "completed", "failed", "draft"].map((status) => (
            <button
              key={status}
              onClick={() => {
                onStatusChange(status);
                setPage(1);
              }}
              className={`glass-pill text-xs ${statusFilter === status ? "glass-pill-active" : ""}`}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
          <select
            value={groupId}
            onChange={(e) => {
              onGroupChange(e.target.value);
              setPage(1);
            }}
            className="glass-input !rounded-full !px-3 !py-1.5 !text-xs"
          >
            <option value="">全部分组</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              setPage(1);
            }}
            placeholder="搜索标题..."
            className="glass-input !rounded-full !px-3 !py-1.5 !text-xs"
          />
        </div>
      </div>

      {loading && <p className="p-8 text-sm text-zinc-400">加载中...</p>}
      {error && <p className="p-8 text-sm text-red-500">{error}</p>}
      {!loading && !error && articles.length === 0 && <p className="p-8 text-sm text-zinc-400">暂无文章。点击“新建文章”开始生产。</p>}

      {!loading && !error && articles.length > 0 && (
        <div className="divide-y divide-black/5">
          {articles.map((article) => (
            <div key={article.id} data-testid={`article-row-${article.id}`} className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-[1fr_8rem_7rem_8rem_12rem] lg:items-center">
              <div className="min-w-0">
                <h3 className="truncate font-medium text-zinc-900">{article.title || "未命名文章"}</h3>
                <p className="mt-0.5 text-xs text-zinc-400">
                  {article.group?.name ?? "未分组"} · {article.prompt?.name ?? "无提示词"}
                </p>
              </div>
              <div>
                <p className="mb-1 text-[11px] text-zinc-400 lg:hidden">生成状态</p>
                <span data-testid={`article-status-${article.id}`} className={statusClass(article.status)}>
                  {STATUS_LABELS[article.status] ?? "未知状态"}
                </span>
              </div>
              <div>
                <p className="mb-1 text-[11px] text-zinc-400 lg:hidden">推送状态</p>
                <span className={article.pushStatus === "pushed" ? "badge-ok" : article.pushStatus === "failed" ? "badge-err" : "badge-muted"}>
                  {PUSH_STATUS_LABELS[article.pushStatus] ?? "未推送"}
                </span>
              </div>
              <div>
                <p className="mb-1 text-[11px] text-zinc-400 lg:hidden">更新时间</p>
                <span className="text-xs text-zinc-500">{new Date(article.updatedAt).toLocaleString()}</span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <Link href={`/formatter?articleId=${article.id}`} className="text-teal-600 hover:underline">
                  排版
                </Link>
                <button type="button" onClick={() => setNotice("公众号推送接口预留，暂未配置。")} className="text-zinc-500 hover:text-zinc-700">
                  推送
                </button>
                <button onClick={() => handleDelete(article.id)} className="text-red-400 hover:text-red-600">
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {total > 20 && (
        <div className="flex items-center justify-between border-t border-black/5 p-4 text-sm text-zinc-500">
          <span>共 {total} 条</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="glass-pill text-xs disabled:opacity-30">
              上一页
            </button>
            <span className="px-3 py-1">
              {page} / {Math.ceil(total / 20)}
            </span>
            <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage((p) => p + 1)} className="glass-pill text-xs disabled:opacity-30">
              下一页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
