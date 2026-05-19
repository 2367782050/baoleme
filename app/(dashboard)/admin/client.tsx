"use client";

import { useState, useEffect } from "react";

const TABS = ["概览", "用户管理", "会员管理", "订单管理", "提现审核", "AI 任务"] as const;
type Tab = (typeof TABS)[number];

export function AdminClient() {
  const [tab, setTab] = useState<Tab>("概览");
  const [error, setError] = useState("");
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [withdrawals, setWithdrawals] = useState<Record<string, unknown>[]>([]);
  const [pj, setPj] = useState<Record<string, unknown>[]>([]);
  const [aj, setAj] = useState<Record<string, unknown>[]>([]);
  const [keyword, setKeyword] = useState("");

  async function refreshList(url: string, setter: (data: Record<string, unknown>[]) => void) {
    const r = await fetch(url); const b = await r.json();
    if (b.success) setter(b.data.items);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [uRes, oRes, wRes, pjRes, ajRes] = await Promise.allSettled([
        fetch("/api/admin/users?pageSize=100").then(r => r.json()),
        fetch("/api/admin/orders?pageSize=100").then(r => r.json()),
        fetch("/api/admin/withdrawals?pageSize=100").then(r => r.json()),
        fetch("/api/admin/jobs/prompts").then(r => r.json()),
        fetch("/api/admin/jobs/articles").then(r => r.json()),
      ]);
      if (cancelled) return;
      const userBody = uRes.status === "fulfilled" ? uRes.value : null;
      if (!userBody?.success) { setError(userBody?.error?.message ?? "无权限访问后台"); return; }
      setUsers(userBody.data.items);
      if (oRes.status === "fulfilled" && oRes.value.data) setOrders(oRes.value.data.items);
      if (wRes.status === "fulfilled" && wRes.value.data) setWithdrawals(wRes.value.data.items);
      if (pjRes.status === "fulfilled" && pjRes.value.data) setPj(pjRes.value.data.items);
      if (ajRes.status === "fulfilled" && ajRes.value.data) setAj(ajRes.value.data.items);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function toggleUserStatus(id: string, status: string) {
    const ns = status === "active" ? "disabled" : "active";
    await fetch(`/api/admin/users/${id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: ns }) });
    await refreshList("/api/admin/users?pageSize=100", setUsers);
  }

  async function grantMembership(userId: string) {
    const planId = prompt("输入套餐 ID (plan uuid):"); if (!planId) return;
    const d = prompt("有效天数 (默认365):");
    await fetch("/api/admin/membership/grant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, planId, durationDays: d ? Number(d) : undefined }) });
    alert("已开通");
  }

  async function generateCodes() {
    const planId = prompt("套餐 ID:"); if (!planId) return;
    const count = prompt("数量:"); if (!count) return;
    const r = await fetch("/api/admin/membership/codes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId, count: Number(count) }) });
    const b = await r.json();
    alert(b.success ? `已生成: ${b.data.codes.join(", ")}` : (b.error?.message ?? "失败"));
    if (b.success) navigator.clipboard.writeText(b.data.codes.join("\n"));
  }

  async function reviewW(id: string, action: string) {
    await fetch(`/api/admin/withdrawals/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    await refreshList("/api/admin/withdrawals?pageSize=100", setWithdrawals);
  }

  async function openTab(nextTab: Tab) {
    setTab(nextTab);
    if (nextTab === "用户管理") await refreshList("/api/admin/users?pageSize=100", setUsers);
    if (nextTab === "订单管理") await refreshList("/api/admin/orders?pageSize=100", setOrders);
    if (nextTab === "提现审核") await refreshList("/api/admin/withdrawals?pageSize=100", setWithdrawals);
    if (nextTab === "AI 任务") {
      await refreshList("/api/admin/jobs/prompts", setPj);
      await refreshList("/api/admin/jobs/articles", setAj);
    }
  }

  if (error && tab !== "概览") return <div className="mx-auto max-w-6xl px-6 py-12 text-sm text-red-500">{error}</div>;

  const filteredUsers = keyword ? users.filter((u: Record<string, unknown>) => String(u.username).includes(keyword) || String(u.email).includes(keyword)) : users;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-bold text-zinc-900">后台运营</h1>
      <div className="mt-4 flex gap-1 border-b border-zinc-200 overflow-x-auto">
        {TABS.map(t => <button key={t} onClick={() => void openTab(t)} className={`shrink-0 px-4 py-2 text-sm font-medium border-b-2 ${tab === t ? "border-zinc-900 text-zinc-900" : "border-transparent text-zinc-500"}`}>{t}</button>)}
      </div>

      <div className="mt-6">
        {tab === "概览" && <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[{ label: "用户", v: users.length }, { label: "订单", v: orders.length }, { label: "待审提现", v: withdrawals.filter((w: Record<string, unknown>) => w.status === "pending").length }, { label: "提示词任务", v: pj.length }, { label: "文章任务", v: aj.length }].map(({ label, v }) => <div key={label} className="rounded-xl border border-zinc-200 p-4"><div className="text-2xl font-bold text-zinc-900">{v}</div><div className="text-xs text-zinc-400">{label}</div></div>)}
        </div>}

        {tab === "用户管理" && <div data-testid="admin-users-panel">
          <input value={keyword} onChange={e => setKeyword(e.target.value)} placeholder="搜索用户名/邮箱..." className="mb-4 rounded border border-zinc-300 px-3 py-1.5 text-sm" />
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs text-zinc-400"><th className="py-2 pr-2">用户名</th><th className="py-2 pr-2">邮箱</th><th className="py-2 pr-2">角色</th><th className="py-2 pr-2">状态</th><th className="py-2">操作</th></tr></thead><tbody>{filteredUsers.map((u: Record<string, unknown>) => <tr key={String(u.id)} data-testid={`admin-user-row-${String(u.id)}`} className="border-b border-zinc-100"><td className="py-2 pr-2 font-medium">{String(u.username)}</td><td className="py-2 pr-2 text-zinc-500">{String(u.email)}</td><td className="py-2 pr-2">{String(u.role)}</td><td className="py-2 pr-2"><span data-testid={`admin-user-status-${String(u.id)}`} className={u.status === "active" ? "text-green-600" : "text-red-500"}>{String(u.status)}</span></td><td className="py-2 space-x-2"><button data-testid={`admin-user-toggle-${String(u.id)}`} onClick={() => toggleUserStatus(String(u.id), String(u.status))} className="text-xs text-blue-600">{u.status === "active" ? "禁用" : "启用"}</button><button onClick={() => grantMembership(String(u.id))} className="text-xs text-green-600">开通会员</button></td></tr>)}</tbody></table></div>
        </div>}

        {tab === "会员管理" && <div data-testid="admin-membership-panel" className="space-y-2">
          <button onClick={generateCodes} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">生成会员码</button>
          <p className="text-xs text-zinc-400 mt-2">在用户管理中可为用户开通会员</p>
        </div>}

        {tab === "订单管理" && <div data-testid="admin-orders-panel" className="space-y-2">
          <h2 className="sr-only">订单管理</h2>
          {orders.length === 0 ? <p className="text-sm text-zinc-400">暂无订单</p> : orders.map((o: Record<string, unknown>) => <div key={String(o.id)} data-testid={`admin-order-row-${String(o.id)}`} className="rounded-lg border border-zinc-100 px-4 py-2 flex justify-between"><span className="text-sm">{(o.user as Record<string, unknown>)?.username as string ?? ""} · {(o.plan as Record<string, unknown>)?.name as string ?? ""} · ¥{Number(o.amountCents) / 100}</span><span className="text-xs text-zinc-400">{String(o.status)} · {new Date(String(o.createdAt)).toLocaleDateString()}</span></div>)}
        </div>}

        {tab === "提现审核" && <div data-testid="admin-withdrawals-panel" className="space-y-2">
          {withdrawals.length === 0 ? <p className="text-sm text-zinc-400">暂无提现申请</p> : withdrawals.map((w: Record<string, unknown>) => <div key={String(w.id)} data-testid={`admin-withdrawal-row-${String(w.id)}`} className="rounded-lg border border-zinc-100 px-4 py-3 flex justify-between items-center"><div><p className="text-sm">{(w.user as Record<string, unknown>)?.username as string ?? ""} · ¥{Number(w.amountCents) / 100} · {String(w.alipayName)}</p><p className="text-xs text-zinc-400">{String(w.status)} · {new Date(String(w.createdAt)).toLocaleDateString()}</p></div>{w.status === "pending" && <div className="flex gap-2"><button onClick={() => reviewW(String(w.id), "approved")} className="text-xs text-green-600">通过</button><button onClick={() => reviewW(String(w.id), "rejected")} className="text-xs text-red-500">驳回</button></div>}</div>)}
        </div>}

        {tab === "AI 任务" && <div data-testid="admin-ai-panel">
          <h3 className="text-sm font-semibold text-zinc-500 mb-2">提示词生成任务</h3>
          <div className="space-y-1 mb-6">{pj.map((j: Record<string, unknown>) => <div key={String(j.id)} className="rounded border border-zinc-100 px-3 py-1 text-xs flex justify-between"><span>{(j.user as Record<string, unknown>)?.username as string ?? ""}</span><span className={j.status === "failed" ? "text-red-500" : "text-green-600"}>{String(j.status)}</span><span className="text-zinc-400">{j.errorMessage ? String(j.errorMessage).substring(0, 40) : ""}</span></div>)}</div>
          <h3 className="text-sm font-semibold text-zinc-500 mb-2">文章生成任务</h3>
          <div className="space-y-1">{aj.map((j: Record<string, unknown>) => <div key={String(j.id)} className="rounded border border-zinc-100 px-3 py-1 text-xs flex justify-between"><span>{(j.user as Record<string, unknown>)?.username as string ?? ""} · {(j.article as Record<string, unknown>)?.title as string ?? ""}</span><span className={j.status === "failed" ? "text-red-500" : "text-green-600"}>{String(j.status)}</span><span className="text-zinc-400">{j.errorMessage ? String(j.errorMessage).substring(0, 40) : ""}</span></div>)}</div>
        </div>}
      </div>
    </div>
  );
}
