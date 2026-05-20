"use client";

import { useState, useEffect } from "react";

type MembershipInfo = { planName: string; planCode: string; status: string; startsAt: string; expiresAt: string; source: string; capabilities: Record<string, number> };
type Plan = { id: string; code: string; name: string; priceCents: number; originalPriceCents: number; durationDays: number; capabilities: Record<string, number> };
type QuotaInfo = Record<string, { used: number; limit: number; remaining: number }>;

export function MembershipClient({ current, plans, quota }: { current: { membership: MembershipInfo | null } | null; plans: Plan[]; quota: QuotaInfo }) {
  const membership = current?.membership ?? null;
  const [orders, setOrders] = useState<{ id: string; plan: { name: string }; amountCents: number; orderNo: string; status: string; createdAt: string }[]>([]);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemMsg, setRedeemMsg] = useState("");

  useEffect(() => { refreshOrders(); }, []);

  async function refreshOrders() { const r = await fetch("/api/orders"); const b = await r.json(); if (b.success) setOrders(b.data); }
  async function handleRedeem(e: React.FormEvent) { e.preventDefault(); setRedeemMsg(""); const r = await fetch("/api/membership/redeem-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: redeemCode }) }); const b = await r.json(); setRedeemMsg(b.success ? (b.message ?? "兑换成功") : (b.error?.message ?? "兑换失败")); if (b.success) { setRedeemCode(""); window.location.reload(); } }
  async function handlePay(orderId: string) { const r = await fetch(`/api/orders/${orderId}/mock-pay`, { method: "POST" }); const b = await r.json(); if (b.success) window.location.reload(); else alert(b.error?.message ?? "支付失败"); }
  async function handleBuy(planId: string) { const r = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId }) }); const b = await r.json(); if (b.success) { alert("订单已创建，请模拟支付"); refreshOrders(); } else alert(b.error?.message ?? "创建失败"); }

  const quotaLabels: Record<string, string> = { prompt_generate: "提示词生成", article_generate: "文章生成", material_export: "素材导出", image_upload: "图片上传", draft_push: "草稿推送", official_account_bind: "公众号数" };

  return (
    <div className="glass-page pt-6 pb-20 px-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-2xl font-bold text-zinc-900 mb-8">会员中心</h1>

        {/* Current membership */}
        <div className="glass-card p-6 mb-6">
          <h2 className="font-semibold text-zinc-900 mb-3">我的会员</h2>
          {membership ? (
            <div className="flex flex-wrap gap-4 text-sm text-zinc-600">
              <span className="font-medium text-zinc-900">{membership.planName}</span>
              <span className={membership.status === "active" ? "badge-ok" : "badge-warn"}>{membership.status === "active" ? "生效中" : membership.status}</span>
              <span>到期: {new Date(membership.expiresAt).toLocaleDateString("zh-CN")}</span>
              <span>来源: {membership.source}</span>
            </div>
          ) : <p className="text-sm text-zinc-400">暂无有效会员</p>}
        </div>

        {/* Quota */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {Object.entries(quota).map(([key, val]) => (
            <div key={key} className="glass-tile px-3 py-2.5">
              <p className="text-[11px] text-zinc-400 truncate">{quotaLabels[key] ?? key}</p>
              <p className="text-lg font-bold text-zinc-800">{val.remaining}<span className="text-xs text-zinc-400 font-normal">/{val.limit}</span></p>
            </div>
          ))}
        </div>

        {/* Plans */}
        <h2 className="font-semibold text-zinc-900 mb-4">会员套餐</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          {plans.map(plan => (
            <div key={plan.id} className="glass-card p-6 flex flex-col">
              <h3 className="font-semibold text-zinc-900 text-lg">{plan.name}</h3>
              <div className="mt-3">
                <span className="text-3xl font-bold text-zinc-900">¥{(plan.priceCents / 100).toFixed(0)}</span>
                {plan.originalPriceCents > plan.priceCents && <span className="ml-2 text-sm text-zinc-400 line-through">¥{(plan.originalPriceCents / 100).toFixed(0)}</span>}
              </div>
              <p className="text-xs text-zinc-400 mt-1">{plan.durationDays >= 365 ? `${plan.durationDays / 365}年` : plan.durationDays >= 30 ? `${plan.durationDays / 30}个月` : `${plan.durationDays}天`}</p>
              <ul className="mt-4 space-y-1.5 text-xs text-zinc-500 flex-1">
                {Object.entries(plan.capabilities as Record<string, number>).map(([k, v]) => <li key={k} className="flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-teal-400" />{k}: {v}</li>)}
              </ul>
              <button onClick={() => handleBuy(plan.id)} className={plan.code === "free" ? "glass-btn-secondary mt-5 w-full" : "glass-btn-primary mt-5 w-full"}>{plan.code === "free" ? "默认套餐" : "开通"}</button>
            </div>
          ))}
        </div>

        {/* Orders */}
        <div className="glass-panel p-6 mb-6">
          <h2 className="font-semibold text-zinc-900 mb-3">我的订单</h2>
          {orders.length === 0 ? <p className="text-sm text-zinc-400">暂无订单</p> : (
            <div className="space-y-2">
              {orders.map(o => (
                <div key={o.id} className="flex items-center justify-between py-3 glass-divider last:border-0">
                  <div>
                    <p className="text-sm font-medium text-zinc-700">{o.plan.name} · {o.orderNo}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">¥{(o.amountCents / 100).toFixed(2)} · <span className={o.status === "paid" ? "badge-ok" : "badge-warn"}>{o.status}</span> · {new Date(o.createdAt).toLocaleDateString()}</p>
                  </div>
                  {o.status === "pending" && <button onClick={() => handlePay(o.id)} className="glass-btn-primary !text-xs !py-1.5 !px-3">模拟支付</button>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Redeem */}
        <div className="glass-panel p-6">
          <h2 className="font-semibold text-zinc-900 mb-3">会员码兑换</h2>
          <form onSubmit={handleRedeem} className="flex gap-3">
            <input value={redeemCode} onChange={e => setRedeemCode(e.target.value)} placeholder="输入会员码" className="glass-input flex-1 max-w-xs text-sm" />
            <button type="submit" className="glass-btn-primary">兑换</button>
          </form>
          {redeemMsg && <p className="mt-2 text-sm text-amber-600">{redeemMsg}</p>}
        </div>
      </div>
    </div>
  );
}
