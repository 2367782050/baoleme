"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

type DashboardData = {
  user: {
    username: string;
    email: string;
    role: string;
  };
  membership: {
    planName: string;
    planCode: string;
    status: string;
    expiresAt: string;
  } | null;
  quota: Record<string, { used: number; limit: number; remaining: number }>;
};

export function DashboardClient({ data }: { data: DashboardData }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const navCards = [
    { title: "爆款素材", href: "/materials" },
    { title: "提示词库", href: "/prompts" },
    { title: "智能创作", href: "/writing" },
    { title: "一键排版", href: "/formatter" },
    { title: "公众号", href: "/official-accounts" },
    { title: "会员中心", href: "/membership" },
    { title: "推广中心", href: "/referral" },
    ...(data.user.role === "admin" || data.user.role === "super_admin" ? [{ title: "后台运营", href: "/admin" }] : []),
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      {/* User banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-8 border-b border-zinc-200">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            你好，{data.user.username}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {data.membership ? (
              <>
                当前会员：<span className="font-medium text-zinc-700">{data.membership.planName}</span>
                <span className="mx-1">·</span>
                {data.membership.status === "active" ? "生效中" : data.membership.status}
              </>
            ) : (
              "暂无有效会员"
            )}
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-zinc-500 hover:text-zinc-700 transition-colors self-start"
        >
          退出登录
        </button>
      </div>

      {/* Quota summary */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
          配额摘要
        </h2>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.entries(data.quota).map(([key, val]) => (
            <div
              key={key}
              className="rounded-lg border border-zinc-200 px-4 py-3"
            >
              <div className="text-xs text-zinc-400 truncate">{key}</div>
              <div className="mt-1 text-lg font-semibold text-zinc-900">
                {val.remaining}
                <span className="text-xs text-zinc-400 font-normal">/{val.limit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature nav */}
      <div className="mt-10">
        <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
          功能入口
        </h2>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {navCards.map(({ title, href }) => (
            <Link
              key={title}
              href={href}
              className="block rounded-xl border border-zinc-200 p-6 hover:border-zinc-300 hover:shadow-sm transition-all"
            >
              <h3 className="font-semibold text-zinc-900">{title}</h3>
              <p className="mt-1 text-sm text-zinc-400">功能开发中</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
