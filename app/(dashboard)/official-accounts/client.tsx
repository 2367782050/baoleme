"use client";

import { useState, useEffect } from "react";

type OA = { id: string; name: string; appid: string; status: string; group: { name: string } | null };

export function OAClient() {
  const [accounts, setAccounts] = useState<OA[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let c = false;
    async function load() { setLoading(true); const r = await fetch("/api/official-accounts"); const b = await r.json(); if (!c && b.success) setAccounts(b.data); if (!c) setLoading(false); }
    load(); return () => { c = true; };
  }, [refresh]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); if (!name.trim()) return;
    const r = await fetch("/api/official-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
    const b = await r.json();
    if (!b.success) { setError(b.error?.message ?? "创建失败"); return; }
    setName(""); setError(""); setRefresh(k => k + 1);
  }
  async function handleDelete(id: string) { if (!confirm("确定删除？")) return; await fetch(`/api/official-accounts?id=${id}`, { method: "DELETE" }); setRefresh(k => k + 1); }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900">公众号管理</h1>
      <p className="mt-2 text-sm text-amber-600">微信开放平台未配置，当前为模拟授权模式</p>

      <form onSubmit={handleCreate} className="mt-6 flex gap-3">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="公众号名称" required className="rounded-lg border border-zinc-300 px-3 py-2 text-sm flex-1 max-w-xs" />
        <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">创建 mock 公众号</button>
      </form>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      <div className="mt-8">
        {loading && <p className="text-sm text-zinc-400">加载中...</p>}
        {!loading && accounts.length === 0 && <p className="text-sm text-zinc-400">暂无公众号</p>}
        {!loading && accounts.length > 0 && (
          <div className="space-y-3">
            {accounts.map(a => (
              <div key={a.id} className="rounded-xl border border-zinc-200 p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-zinc-900">{a.name}</p>
                  <p className="text-xs text-zinc-400">{a.appid} · {a.status === "mock_authorized" ? "模拟授权" : a.status}</p>
                </div>
                <button onClick={() => handleDelete(a.id)} className="text-sm text-red-400 hover:text-red-600">删除</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
