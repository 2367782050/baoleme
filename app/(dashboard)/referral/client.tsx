"use client";

import { useState, useEffect } from "react";
import { formatCommissionStatus, formatWithdrawalStatus } from "@/lib/ui/labels";

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

  async function handleWithdraw(e: React.FormEvent) { e.preventDefault(); setMsg(""); const r = await fetch("/api/referral/withdrawals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(wForm) }); const b = await r.json(); setMsg(b.success ? "提现申请已提交" : (b.error?.message ?? "失败")); if (b.success) { setWForm({ amountCents: 0, alipayName: "", alipayAccount: "" }); fetch("/api/referral/withdrawals").then(r => r.json()).then(b => { if (b.success) setWithdrawals(b.data); }); } }

  return (
    <div className="glass-page depth-page pt-6 pb-20 px-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-zinc-900 mb-8">推广中心</h1>

        {/* Invite code card */}
        {summary && (
          <div className="glass-card p-6 mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <div>
                <p className="text-sm text-zinc-500 mb-1">你的邀请码</p>
                <p className="text-3xl font-bold text-teal-600 tracking-widest">{summary.referralCode as string}</p>
              </div>
              <div className="flex gap-6">
                <div><p className="text-xs text-zinc-400">邀请人数</p><p className="text-xl font-bold text-zinc-900">{summary.invitedCount as number}</p></div>
                <div><p className="text-xs text-zinc-400">累计佣金</p><p className="text-xl font-bold text-zinc-900">¥{((summary.totalCommission as number) / 100).toFixed(2)}</p></div>
                <div><p className="text-xs text-zinc-400">可提现</p><p className="text-xl font-bold text-teal-600">¥{((summary.availableCents as number) / 100).toFixed(2)}</p></div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[["users", "邀请用户"], ["commissions", "佣金记录"], ["withdrawals", "提现记录"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k as typeof tab)}
              className={`glass-pill ${tab === k ? "glass-pill-active" : ""}`}>{l}</button>
          ))}
        </div>

        {tab === "users" && <div className="space-y-2">{users.map(u => <div key={u.id} className="glass-tile px-4 py-3 flex justify-between"><span className="text-sm text-zinc-700">{u.username}</span><span className="text-xs text-zinc-400">{new Date(u.createdAt).toLocaleDateString()}</span></div>)}</div>}

        {tab === "commissions" && <div className="space-y-2">{commissions.map(c => <div key={c.id} className="glass-tile px-4 py-3"><p className="text-sm text-zinc-700">¥{(c.amountCents / 100).toFixed(2)} · {c.referred?.username ?? "未知"} · {c.order?.orderNo ?? ""}</p><span className="badge-muted text-[10px]">{formatCommissionStatus(c.status)}</span></div>)}</div>}

        {tab === "withdrawals" && (
          <div>
            <form onSubmit={handleWithdraw} className="glass-panel p-5 mb-4 space-y-3 max-w-sm">
              <input placeholder="支付宝姓名" value={wForm.alipayName} onChange={e => setWForm(f => ({ ...f, alipayName: e.target.value }))} className="glass-input w-full text-sm" />
              <input placeholder="支付宝账号" value={wForm.alipayAccount} onChange={e => setWForm(f => ({ ...f, alipayAccount: e.target.value }))} className="glass-input w-full text-sm" />
              <input type="number" placeholder="提现金额（分）" value={wForm.amountCents} onChange={e => setWForm(f => ({ ...f, amountCents: Number(e.target.value) }))} className="glass-input w-full text-sm" />
              <button type="submit" className="glass-btn-primary w-full">提交提现</button>
              {msg && <p className="text-sm text-amber-600">{msg}</p>}
            </form>
            <div className="space-y-2">{withdrawals.map(w => <div key={w.id} className="glass-tile px-4 py-3 flex justify-between items-center"><span className="text-sm text-zinc-700">¥{(w.amountCents / 100).toFixed(2)}</span><span className="text-xs text-zinc-400"><span className={w.status === "pending" ? "badge-warn" : w.status === "approved" ? "badge-ok" : "badge-muted"}>{formatWithdrawalStatus(w.status)}</span> · {new Date(w.createdAt).toLocaleDateString()}</span></div>)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
