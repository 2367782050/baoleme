"use client";

import { useState, useEffect } from "react";
import { useModal } from "@/components/ui/modal";

type Topic = {
  id: string;
  platform: string;
  title: string;
  url: string | null;
  rank: number;
  heatScore: number | string;
  snapshotAt: string;
};

const PLATFORMS = [
  { label: "全部", value: "" },
  { label: "公众号", value: "wechat" },
  { label: "小红书", value: "xiaohongshu" },
  { label: "抖音", value: "douyin" },
  { label: "头条", value: "toutiao" },
];

export function HotTopicList() {
  const modal = useModal();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [platform, setPlatform] = useState("");

  const pageSize = 20;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (platform) params.set("platform", platform);
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));

        const res = await fetch(`/api/material/hot-topics?${params}`);
        const body = await res.json();
        if (cancelled) return;
        if (!body.success) {
          setError(body.error?.message ?? "加载失败");
          return;
        }
        setTopics(body.data.items);
        setTotal(body.data.total);
      } catch {
        if (!cancelled) setError("网络错误");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [page, platform]);

  async function handleExport() {
    try {
      const res = await fetch("/api/material/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "topics", filters: { platform } }),
      });
      const body = await res.json();
      if (!body.success) {
        await modal.open({ title: "导出失败", message: body.error?.message ?? "导出失败" });
        return;
      }
      const blob = new Blob(["﻿" + body.data.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "hot-topics.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      await modal.open({ title: "导出失败", message: "导出失败" });
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900 mb-4">热搜榜</h2>

      <div className="flex flex-wrap gap-3 mb-4">
        {PLATFORMS.map((p) => (
          <button
            key={p.value}
            onClick={() => { setPlatform(p.value); setPage(1); }}
            className={`glass-pill px-4 py-1.5 text-sm ${(platform || "") === p.value ? "bg-teal-500/90 text-white border-teal-400/50" : "text-zinc-600 hover:text-zinc-900"}`}
          >
            {p.label}
          </button>
        ))}
        <button
          onClick={handleExport}
          className="glass-pill px-4 py-1.5 text-sm text-zinc-600 hover:text-zinc-900 ml-auto"
        >
          导出 CSV
        </button>
      </div>

      {loading && <p className="text-sm text-zinc-400 py-8">加载中...</p>}
      {error && <p className="text-sm text-red-500 py-8">{error}</p>}
      {!loading && !error && topics.length === 0 && (
        <p className="text-sm text-zinc-400 py-8">暂无热搜数据</p>
      )}

      {!loading && !error && topics.length > 0 && (
        <>
          <div className="space-y-2">
            {topics.map((t) => (
              <div
                key={t.id}
                className="glass-card flex items-center gap-4 px-4 py-3"
              >
                <span className={`text-lg font-bold w-8 ${
                  t.rank <= 3 ? "text-red-500" : "text-zinc-400"
                }`}>
                  {t.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-900 truncate">
                    {t.title}
                  </p>
                  <p className="text-xs text-zinc-400">{t.platform} · 热度 {String(t.heatScore)}</p>
                </div>
                {t.url && (
                  <a
                    href={t.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs text-zinc-400 hover:text-zinc-600"
                  >
                    查看
                  </a>
                )}
              </div>
            ))}
          </div>

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
        </>
      )}
    </div>
  );
}
