"use client";

import { useState } from "react";
import { ArticleList } from "@/components/feature/writing/ArticleList";
import { CreateForm } from "@/components/feature/writing/CreateForm";

export function WritingClient() {
  const [showCreate, setShowCreate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [groupId, setGroupId] = useState("");

  return (
    <div className="glass-page depth-page pt-6 pb-20 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">智能创作</h1>
            <p className="text-sm text-zinc-500 mt-1">AI 辅助生成高质量文章</p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="glass-btn-primary">
            {showCreate ? "关闭" : "开始创作"}
          </button>
        </div>

        {/* Three-column layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left sidebar: Article status filters */}
          <div className="lg:w-48 shrink-0">
            <div className="glass-panel p-4">
              <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">我的文章</h3>
              <div className="space-y-0.5">
                {[
                  { s: "", label: "全部文章" },
                  { s: "generating", label: "创作中" },
                  { s: "completed", label: "已完成" },
                  { s: "failed", label: "失败" },
                ].map(({ s, label }) => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${statusFilter === s ? "bg-white/60 text-zinc-900 font-medium" : "text-zinc-600 hover:bg-white/30"}`}>{label}</button>
                ))}
              </div>

              {/* Inspiration card */}
              <div className="mt-6 p-3 rounded-2xl bg-gradient-to-br from-violet-400/10 to-sky-400/10">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  <span className="font-medium text-zinc-700">创作灵感</span><br />
                  好的标题是爆款的一半，试试用数字型或疑问型标题结构。
                </p>
              </div>
            </div>
          </div>

          {/* Center: Create form or article list */}
          <div className="flex-1 min-w-0">
            {showCreate && (
              <div className="glass-card p-6 mb-6 depth-drawer">
                <CreateForm onSuccess={() => { setRefreshKey(k => k + 1); setShowCreate(false); }} />
              </div>
            )}
            <ArticleList refreshKey={refreshKey} statusFilter={statusFilter} groupId={groupId}
              onStatusChange={setStatusFilter} onGroupChange={setGroupId}
              onRefresh={() => setRefreshKey(k => k + 1)} />
          </div>

          {/* Right: Progress & tips */}
          <div className="lg:w-52 shrink-0">
            <div className="glass-panel p-4 space-y-5">
              <div>
                <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3">创作进度</h3>
                <div className="space-y-2">
                  {["主题分析", "资料收集", "大纲生成", "内容创作", "润色优化"].map((step, i) => (
                    <div key={step} className="flex items-center gap-2 text-xs text-zinc-400">
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${i === 0 ? "bg-gradient-to-br from-sky-400 to-teal-400 text-white" : "bg-zinc-100 text-zinc-400"}`}>{i + 1}</span>
                      {step}
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-divider pt-4">
                <h4 className="text-xs font-medium text-zinc-500 mb-2">创作小贴士</h4>
                <p className="text-xs text-zinc-400 leading-relaxed">选择高质量素材和合适的提示词，生成效果更佳。风格化的提示词能让文章更有辨识度。</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
