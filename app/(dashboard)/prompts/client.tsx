"use client";

import { useState, useEffect } from "react";
import { GroupList } from "@/components/feature/prompts/GroupList";
import { PromptList } from "@/components/feature/prompts/PromptList";
import { GenerateForm } from "@/components/feature/prompts/GenerateForm";

type Group = { id: string; name: string; description: string | null };

export function PromptsClient() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await fetch("/api/prompts/groups");
      const body = await res.json();
      if (!cancelled && body.success) setGroups(body.data);
    }
    load();
    return () => { cancelled = true; };
  }, [refreshKey]);

  return (
    <div className="glass-page depth-page pt-6 pb-20 px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">提示词库</h1>
            <p className="text-sm text-zinc-500 mt-1">管理你的 AI 提示词，生成高分创作指令</p>
          </div>
          <button onClick={() => setShowGenerate(!showGenerate)} className="glass-btn-primary">
            {showGenerate ? "关闭生成" : "生成提示词"}
          </button>
        </div>

        {showGenerate && (
          <div className="glass-card p-6 mb-6 depth-drawer">
            <GenerateForm
              groups={groups}
              onSuccess={() => { setRefreshKey(k => k + 1); setShowGenerate(false); }}
            />
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-56 shrink-0">
            <div className="glass-panel p-4">
              <GroupList
                groups={groups}
                selectedId={selectedGroupId}
                onSelect={setSelectedGroupId}
                onRefresh={() => setRefreshKey(k => k + 1)}
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <PromptList
              groupId={selectedGroupId}
              groups={groups}
              refreshKey={refreshKey}
              onRefresh={() => setRefreshKey(k => k + 1)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
