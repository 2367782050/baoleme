"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

type Account = {
  id: string;
  platform: string;
  name: string;
  avatarUrl: string | null;
  domainName: string | null;
  avgTopReadCount: number;
  avgReadCount: number;
  postCountDaily: number | string;
  likeCountTotal: number;
  originalIndex: number | string;
  rank: number;
  isFavorited: boolean;
};

export function AccountList({
  platform = "wechat",
  title = "公众号榜单",
}: {
  platform?: string;
  title?: string;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
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
        if (platform) params.set("platform", platform);
        if (keyword) params.set("keyword", keyword);
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        params.set("sortBy", "rank");
        params.set("sortOrder", "asc");

        const res = await fetch(`/api/material/accounts?${params}`);
        const body = await res.json();
        if (cancelled) return;
        if (!body.success) {
          setError(body.error?.message ?? "加载失败");
          return;
        }
        setAccounts(body.data.items);
        setTotal(body.data.total);
      } catch {
        if (!cancelled) setError("网络错误");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [platform, keyword, page]);

  async function handleFavorite(accountId: string, currentlyFav: boolean) {
    if (currentlyFav) return;
    try {
      const res = await fetch("/api/material/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: "account", targetId: accountId }),
      });
      const body = await res.json();
      if (body.success) {
        setAccounts((prev) =>
          prev.map((a) => (a.id === accountId ? { ...a, isFavorited: true } : a)),
        );
      }
    } catch {
      // silent
    }
  }

  async function handleExport() {
    try {
      const res = await fetch("/api/material/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "accounts", filters: { platform, keyword } }),
      });
      const body = await res.json();
      if (!body.success) {
        alert(body.error?.message ?? "导出失败");
        return;
      }
      const blob = new Blob(["﻿" + body.data.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "accounts.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("导出失败");
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900 mb-4">{title}</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
          placeholder="搜索关键词..."
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm"
        />
        <button
          onClick={handleExport}
          data-testid="material-export-accounts"
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-50"
        >
          导出 CSV
        </button>
      </div>

      {/* States */}
      {loading && <p className="text-sm text-zinc-400 py-8">加载中...</p>}
      {error && <p className="text-sm text-red-500 py-8">{error}</p>}
      {!loading && !error && accounts.length === 0 && (
        <p className="text-sm text-zinc-400 py-8">暂无数据</p>
      )}

      {/* Table */}
      {!loading && !error && accounts.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-zinc-700">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs text-zinc-400 uppercase">
                  <th className="py-2 pr-2">排名</th>
                  <th className="py-2 pr-2">行业</th>
                  <th className="py-2 pr-2">头像</th>
                  <th className="py-2 pr-2">账号名称</th>
                  <th className="py-2 pr-2 text-right">头条平均阅读</th>
                  <th className="py-2 pr-2 text-right">平均阅读</th>
                  <th className="py-2 pr-2 text-right">日发文数</th>
                  <th className="py-2 pr-2 text-right">总点赞数</th>
                  <th className="py-2 pr-2 text-right">原创指数</th>
                  <th className="py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr
                    key={a.id}
                    data-testid={`material-account-row-${a.id}`}
                    className="border-b border-zinc-100 hover:bg-zinc-50"
                  >
                    <td className="py-2 pr-2 font-medium">{a.rank}</td>
                    <td className="py-2 pr-2 text-zinc-500">{a.domainName ?? "-"}</td>
                    <td className="py-2 pr-2">
                      {a.avatarUrl ? (
                        <Image src={a.avatarUrl} alt="" width={24} height={24} className="w-6 h-6 rounded-full object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-zinc-200" />
                      )}
                    </td>
                    <td className="py-2 pr-2 font-medium text-zinc-900">{a.name}</td>
                    <td className="py-2 pr-2 text-right">{a.avgTopReadCount.toLocaleString()}</td>
                    <td className="py-2 pr-2 text-right">{a.avgReadCount.toLocaleString()}</td>
                    <td className="py-2 pr-2 text-right">{String(a.postCountDaily)}</td>
                    <td className="py-2 pr-2 text-right">{a.likeCountTotal.toLocaleString()}</td>
                    <td className="py-2 pr-2 text-right">{String(a.originalIndex)}</td>
                    <td className="py-2 space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => handleFavorite(a.id, a.isFavorited)}
                        data-testid={`material-account-favorite-${a.id}`}
                        className={`text-xs px-2 py-0.5 rounded ${
                          a.isFavorited
                            ? "bg-amber-50 text-amber-600"
                            : "text-zinc-500 hover:text-zinc-700"
                        }`}
                      >
                        {a.isFavorited ? "已收藏" : "收藏"}
                      </button>
                      <Link
                        href={`/writing?source=account&id=${a.id}&name=${encodeURIComponent(a.name)}`}
                        className="text-xs px-2 py-0.5 text-zinc-500 hover:text-zinc-700"
                      >
                        引用创作
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm text-zinc-500">
              <span>共 {total} 条</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded border border-zinc-200 disabled:opacity-30"
                >
                  上一页
                </button>
                <span className="px-3 py-1">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 rounded border border-zinc-200 disabled:opacity-30"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
