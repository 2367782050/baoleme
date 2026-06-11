"use client";

import { useEffect, useState } from "react";
import { GenerateForm } from "@/components/feature/prompts/GenerateForm";
import { GroupList } from "@/components/feature/prompts/GroupList";
import { PromptList } from "@/components/feature/prompts/PromptList";

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
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return (
    <div className="glass-page depth-page px-6 pb-20 pt-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900">提示词库</h1>
            <p className="mt-1 text-sm text-zinc-500">投喂爆文素材生成专属提示词，沉淀可复用的创作指令。</p>
          </div>
          <button onClick={() => setShowGenerate(!showGenerate)} className="glass-btn-primary">
            {showGenerate ? "关闭生成" : "投喂素材生成提示词"}
          </button>
        </div>

        {showGenerate && (
          <div className="glass-card depth-drawer mb-6 p-6">
            <GenerateForm
              groups={groups}
              onSuccess={() => {
                setRefreshKey((key) => key + 1);
                setShowGenerate(false);
              }}
            />
          </div>
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="shrink-0 lg:w-56">
            <div className="glass-panel p-4">
              <GroupList
                groups={groups}
                selectedId={selectedGroupId}
                onSelect={setSelectedGroupId}
                onRefresh={() => setRefreshKey((key) => key + 1)}
              />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <PromptList
              groupId={selectedGroupId}
              groups={groups}
              refreshKey={refreshKey}
              onRefresh={() => setRefreshKey((key) => key + 1)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
