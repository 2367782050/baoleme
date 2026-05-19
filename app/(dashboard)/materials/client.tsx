"use client";

import { useState } from "react";
import { AccountList } from "@/components/feature/materials/AccountList";
import { ArticleList } from "@/components/feature/materials/ArticleList";
import { HotTopicList } from "@/components/feature/materials/HotTopicList";
import { HowToFind } from "@/components/feature/materials/HowToFind";

const TABS = [
  { key: "accounts", label: "公众号榜单" },
  { key: "benchmarks", label: "精品对标号" },
  { key: "topics", label: "热搜榜" },
  { key: "articles", label: "文章素材" },
  { key: "howto", label: "如何找对标" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function MaterialsClient() {
  const [activeTab, setActiveTab] = useState<TabKey>("accounts");

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-bold text-zinc-900">爆款素材</h1>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 border-b border-zinc-200 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-zinc-900 text-zinc-900"
                : "border-transparent text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {activeTab === "accounts" && <AccountList />}
        {activeTab === "benchmarks" && <AccountList platform="" title="精品对标号" />}
        {activeTab === "topics" && <HotTopicList />}
        {activeTab === "articles" && <ArticleList />}
        {activeTab === "howto" && <HowToFind />}
      </div>
    </div>
  );
}
