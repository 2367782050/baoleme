"use client";

import { useState, useEffect } from "react";
import { formatOAStatus } from "@/lib/ui/labels";

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

  async function handleCreate(e: React.FormEvent) { e.preventDefault(); if (!name.trim()) return; const r = await fetch("/api/official-accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) }); const b = await r.json(); if (!b.success) { setError(b.error?.message ?? "创建失败"); return; } setName(""); setError(""); setRefresh(k => k + 1); }
  async function handleDelete(id: string) { if (!confirm("确定删除？")) return; await fetch(`/api/official-accounts?id=${id}`, { method: "DELETE" }); setRefresh(k => k + 1); }

  return (
    <div className="glass-page pt-6 pb-20 px-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">公众号管理</h1>

        {/* Mock mode notice */}
        <div className="glass-panel p-4 mb-6 flex items-center gap-3">
          <span className="badge-warn">模拟授权模式</span>
          <span className="text-sm text-amber-700">当前为模拟授权模式，未连接真实微信开放平台</span>
        </div>

        {/* Create form */}
        <div className="glass-card p-5 mb-6">
          <h2 className="font-semibold text-zinc-900 mb-3">创建公众号</h2>
          <form onSubmit={handleCreate} className="flex gap-3">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="公众号名称" required className="glass-input max-w-xs flex-1 text-sm" />
            <button type="submit" className="glass-btn-primary">创建模拟公众号</button>
          </form>
          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        </div>

        {/* Account list */}
        {loading && <p className="text-sm text-zinc-400">加载中...</p>}
        {!loading && accounts.length === 0 && <p className="text-sm text-zinc-400">暂无公众号</p>}
        {!loading && accounts.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map(a => (
              <div key={a.id} className="glass-tile p-5 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-zinc-900">{a.name}</p>
                  <p className="text-xs text-zinc-400 mt-1 font-mono">{a.appid}</p>
                  <span className="badge-muted text-[10px] mt-1">{formatOAStatus(a.status)}</span>
                </div>
                <button onClick={() => handleDelete(a.id)} className="glass-btn-danger !text-xs !py-1 !px-3">删除</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
