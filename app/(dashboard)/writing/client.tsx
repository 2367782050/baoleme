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
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">智能创作</h1>
        <button onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors">
          {showCreate ? "关闭" : "开始创作"}
        </button>
      </div>

      {showCreate && (
        <div className="mt-6 rounded-xl border border-zinc-200 p-6">
          <CreateForm onSuccess={() => { setRefreshKey(k => k + 1); setShowCreate(false); }} />
        </div>
      )}

      <div className="mt-6">
        <ArticleList refreshKey={refreshKey} statusFilter={statusFilter} groupId={groupId}
          onStatusChange={setStatusFilter} onGroupChange={setGroupId}
          onRefresh={() => setRefreshKey(k => k + 1)} />
      </div>
    </div>
  );
}
