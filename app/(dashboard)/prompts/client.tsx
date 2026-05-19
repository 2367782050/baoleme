"use client";

import { useState, useEffect } from "react";
import { GroupList } from "@/components/feature/prompts/GroupList";
import { PromptList } from "@/components/feature/prompts/PromptList";
import { GenerateForm } from "@/components/feature/prompts/GenerateForm";

type Group = {
  id: string;
  name: string;
  description: string | null;
};

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
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">提示词库</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowGenerate(!showGenerate)}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
          >
            {showGenerate ? "关闭生成" : "生成提示词"}
          </button>
        </div>
      </div>

      {showGenerate && (
        <div className="mt-6 rounded-xl border border-zinc-200 p-6">
          <GenerateForm
            groups={groups}
            onSuccess={() => {
              setRefreshKey((k) => k + 1);
              setShowGenerate(false);
            }}
          />
        </div>
      )}

      <div className="mt-8 flex flex-col lg:flex-row gap-8">
        <div className="lg:w-56 shrink-0">
          <GroupList
            groups={groups}
            selectedId={selectedGroupId}
            onSelect={setSelectedGroupId}
            onRefresh={() => setRefreshKey((k) => k + 1)}
          />
        </div>
        <div className="flex-1 min-w-0">
          <PromptList
            groupId={selectedGroupId}
            groups={groups}
            refreshKey={refreshKey}
            onRefresh={() => setRefreshKey((k) => k + 1)}
          />
        </div>
      </div>
    </div>
  );
}
