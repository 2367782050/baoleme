"use client";

import { useState } from "react";
import { ArticleList } from "@/components/feature/writing/ArticleList";
import { CreateForm } from "@/components/feature/writing/CreateForm";

const STATUS_FILTERS = [
  { value: "", label: "全部文章" },
  { value: "generating", label: "生产中" },
  { value: "completed", label: "已完成" },
  { value: "failed", label: "失败" },
  { value: "draft", label: "草稿" },
];

export function WritingClient() {
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [groupId, setGroupId] = useState("");

  return (
    <div className="glass-page depth-page px-6 pb-20 pt-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">文章生产管理台</h1>
            <p className="mt-1 text-sm text-zinc-500">
              用爆文结构、真实素材和人味改写流程管理文章从生产到排版、推送的成稿链路。
            </p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="glass-btn-primary">
            {showCreate ? "关闭新建" : "新建文章"}
          </button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[12rem_1fr]">
          <aside className="glass-panel p-4">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">生产状态</h3>
            <div className="space-y-0.5">
              {STATUS_FILTERS.map((item) => (
                <button
                  key={item.value}
                  onClick={() => setStatusFilter(item.value)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    statusFilter === item.value ? "bg-white/60 font-medium text-zinc-900" : "text-zinc-600 hover:bg-white/30"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div className="mt-6 rounded-2xl bg-gradient-to-br from-sky-400/10 to-teal-400/10 p-3">
              <p className="text-xs leading-relaxed text-zinc-500">
                <span className="font-medium text-zinc-700">生产建议</span>
                <br />
                先用爆文拆解生成提示词，再补充真实案例和核心观点。系统会做成稿质检，但最终内容仍建议人工审核。
              </p>
            </div>
          </aside>

          <main className="min-w-0">
            {showCreate && (
              <div className="glass-card depth-drawer mb-6 p-6">
                <CreateForm
                  onSuccess={() => {
                    setRefreshKey((key) => key + 1);
                    setShowCreate(false);
                  }}
                />
              </div>
            )}
            <ArticleList
              refreshKey={refreshKey}
              statusFilter={statusFilter}
              groupId={groupId}
              onStatusChange={setStatusFilter}
              onGroupChange={setGroupId}
              onRefresh={() => setRefreshKey((key) => key + 1)}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
