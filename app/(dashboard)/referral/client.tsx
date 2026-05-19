"use client";

import { useState, useEffect } from "react";

export function ReferralClient() {
  const [summary, setSummary] = useState<Record<string, number|string> | null>(null);
  const [users, setUsers] = useState<{ id: string; username: string; createdAt: string }[]>([]);
  const [commissions, setCommissions] = useState<{ id: string; amountCents: number; status: string; referred: { username: string } | null; order: { orderNo: string; amountCents: number } | null }[]>([]);
  const [withdrawals, setWithdrawals] = useState<{ id: string; amountCents: number; status: string; createdAt: string }[]>([]);
  const [tab, setTab] = useState<"users" | "commissions" | "withdrawals">("users");
  const [wForm, setWForm] = useState({ amountCents: 0, alipayName: "", alipayAccount: "" });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/referral/summary").then(r => r.json()).then(b => { if (b.success) setSummary(b.data); });
    fetch("/api/referral/users").then(r => r.json()).then(b => { if (b.success) setUsers(b.data); });
    fetch("/api/referral/commissions").then(r => r.json()).then(b => { if (b.success) setCommissions(b.data); });
    fetch("/api/referral/withdrawals").then(r => r.json()).then(b => { if (b.success) setWithdrawals(b.data); });
  }, []);

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const r = await fetch("/api/referral/withdrawals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(wForm) });
    const b = await r.json();
    setMsg(b.success ? "提现申请已提交" : (b.error?.message ?? "失败"));
    if (b.success) { setWForm({ amountCents: 0, alipayName: "", alipayAccount: "" }); fetch("/api/referral/withdrawals").then(r => r.json()).then(b => { if (b.success) setWithdrawals(b.data); }); }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900">推广中心</h1>

      {summary && (
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-zinc-200 p-4"><div className="text-2xl font-bold text-zinc-900">{summary.invitedCount as number}</div><div className="text-xs text-zinc-400 mt-1">邀请人数</div></div>
          <div className="rounded-xl border border-zinc-200 p-4"><div className="text-2xl font-bold text-zinc-900">{(summary.totalCommission as number / 100).toFixed(2)}</div><div className="text-xs text-zinc-400 mt-1">累计佣金</div></div>
          <div className="rounded-xl border border-zinc-200 p-4"><div className="text-2xl font-bold text-zinc-900">{(summary.availableCents as number / 100).toFixed(2)}</div><div className="text-xs text-zinc-400 mt-1">可提现</div></div>
          <div className="rounded-xl border border-zinc-200 p-4 break-all"><div className="text-xs font-mono text-zinc-600">{summary.referralCode as string}</div><div className="text-xs text-zinc-400 mt-1">邀请码</div></div>
        </div>
      )}

      <div className="mt-8">
        <div className="flex gap-1 border-b border-zinc-200 mb-4">
          {[["users", "邀请用户"], ["commissions", "佣金记录"], ["withdrawals", "提现记录"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k as typeof tab)} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === k ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500"}`}>{l}</button>
          ))}
        </div>

        {tab === "users" && <div className="space-y-2">{users.map(u => <div key={u.id} className="rounded-lg border border-zinc-100 px-4 py-2 flex justify-between"><span className="text-sm text-zinc-700">{u.username}</span><span className="text-xs text-zinc-400">{new Date(u.createdAt).toLocaleDateString()}</span></div>)}</div>}

        {tab === "commissions" && <div className="space-y-2">{commissions.map(c => <div key={c.id} className="rounded-lg border border-zinc-100 px-4 py-3"><p className="text-sm text-zinc-700">¥{(c.amountCents / 100).toFixed(2)} · {c.referred?.username ?? "未知"} · {c.order?.orderNo ?? ""}</p><p className="text-xs text-zinc-400">{c.status}</p></div>)}</div>}

        {tab === "withdrawals" && <>
          <form onSubmit={handleWithdraw} className="mb-4 space-y-3 max-w-sm">
            <input placeholder="支付宝姓名" value={wForm.alipayName} onChange={e => setWForm(f => ({ ...f, alipayName: e.target.value }))} className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
            <input placeholder="支付宝账号" value={wForm.alipayAccount} onChange={e => setWForm(f => ({ ...f, alipayAccount: e.target.value }))} className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
            <input type="number" placeholder="提现金额（分）" value={wForm.amountCents} onChange={e => setWForm(f => ({ ...f, amountCents: Number(e.target.value) }))} className="block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm" />
            <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">提交提现</button>
            {msg && <p className="text-sm text-amber-600">{msg}</p>}
          </form>
          <div className="space-y-2">{withdrawals.map(w => <div key={w.id} className="rounded-lg border border-zinc-100 px-4 py-2 flex justify-between"><span className="text-sm text-zinc-700">¥{(w.amountCents / 100).toFixed(2)}</span><span className="text-xs text-zinc-400">{w.status} · {new Date(w.createdAt).toLocaleDateString()}</span></div>)}</div>
        </>}
      </div>
    </div>
  );
}
