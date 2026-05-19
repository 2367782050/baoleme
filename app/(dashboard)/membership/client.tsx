"use client";

import { useState, useEffect } from "react";

type MembershipInfo = {
  planName: string;
  planCode: string;
  status: string;
  startsAt: string;
  expiresAt: string;
  source: string;
  capabilities: Record<string, number>;
};

type Plan = {
  id: string;
  code: string;
  name: string;
  priceCents: number;
  originalPriceCents: number;
  durationDays: number;
  capabilities: Record<string, number>;
};

type QuotaInfo = Record<string, { used: number; limit: number; remaining: number }>;

export function MembershipClient({
  current,
  plans,
  quota,
}: {
  current: { membership: MembershipInfo | null } | null;
  plans: Plan[];
  quota: QuotaInfo;
}) {
  const membership = current?.membership ?? null;
  const [orders, setOrders] = useState<{ id: string; plan: { name: string }; amountCents: number; orderNo: string; status: string; createdAt: string }[]>([]);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemMsg, setRedeemMsg] = useState("");

  useEffect(() => { fetch("/api/orders").then(r => r.json()).then(b => { if (b.success) setOrders(b.data); }); }, []);

  async function handleRedeem(e: React.FormEvent) { e.preventDefault(); setRedeemMsg(""); const r = await fetch("/api/membership/redeem-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: redeemCode }) }); const b = await r.json(); setRedeemMsg(b.success ? (b.message ?? "兑换成功") : (b.error?.message ?? "兑换失败")); if (b.success) { setRedeemCode(""); window.location.reload(); } }
  async function handlePay(orderId: string) { const r = await fetch(`/api/orders/${orderId}/mock-pay`, { method: "POST" }); const b = await r.json(); if (b.success) window.location.reload(); else alert(b.error?.message ?? "支付失败"); }
  async function handleBuy(planId: string) { const r = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId }) }); const b = await r.json(); if (b.success) { alert("订单已创建，请模拟支付"); fetch("/api/orders").then(r => r.json()).then(b => { if (b.success) setOrders(b.data); }); } else alert(b.error?.message ?? "创建失败"); }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-bold text-zinc-900">会员中心</h1>

      {/* Current membership */}
      <div className="mt-8 rounded-xl border border-zinc-200 p-6">
        <h2 className="font-semibold text-zinc-900">我的会员</h2>
        {membership ? (
          <div className="mt-3 space-y-2 text-sm text-zinc-600">
            <p>
              套餐：<span data-testid="membership-current-plan" className="font-medium text-zinc-900">{membership.planName}</span>
              <span className="ml-2 inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
                {membership.status === "active" ? "生效中" : membership.status}
              </span>
            </p>
            <p>
              到期时间：{new Date(membership.expiresAt).toLocaleDateString("zh-CN")}
            </p>
            <p>开通方式：{membership.source}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">暂无有效会员</p>
        )}
      </div>

      {/* Quota */}
      <div className="mt-6 rounded-xl border border-zinc-200 p-6">
        <h2 className="font-semibold text-zinc-900">配额使用</h2>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(quota).map(([key, val]) => (
            <div key={key} className="rounded-lg border border-zinc-100 px-3 py-2">
              <div className="text-xs text-zinc-400 truncate">{key}</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">
                {val.remaining}/{val.limit}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plans */}
      <div className="mt-8">
        <h2 className="font-semibold text-zinc-900">会员套餐</h2>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="rounded-xl border border-zinc-200 p-6 flex flex-col"
            >
              <h3 className="font-semibold text-zinc-900">{plan.name}</h3>
              <div className="mt-2">
                <span className="text-2xl font-bold text-zinc-900">
                  ¥{(plan.priceCents / 100).toFixed(0)}
                </span>
                {plan.originalPriceCents > plan.priceCents && (
                  <span className="ml-2 text-sm text-zinc-400 line-through">
                    ¥{(plan.originalPriceCents / 100).toFixed(0)}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                {plan.durationDays >= 365
                  ? `${plan.durationDays / 365}年`
                  : plan.durationDays >= 30
                    ? `${plan.durationDays / 30}个月`
                    : `${plan.durationDays}天`}
              </p>
              <ul className="mt-4 space-y-1 text-xs text-zinc-500 flex-1">
                {Object.entries(plan.capabilities as Record<string, number>).map(
                  ([k, v]) => (
                    <li key={k}>
                      {k}：{v}
                    </li>
                  ),
                )}
              </ul>
              <button
                onClick={() => handleBuy(plan.id)}
                className="mt-4 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
              >
                {plan.code === "free" ? "默认套餐" : `开通 ¥${(plan.priceCents / 100).toFixed(0)}`}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* My Orders */}
      <div className="mt-8 rounded-xl border border-zinc-200 p-6">
        <h2 className="font-semibold text-zinc-900">我的订单</h2>
        {orders.length === 0 ? <p className="mt-2 text-sm text-zinc-400">暂无订单</p> : (
          <div className="mt-3 space-y-2">
            {orders.map(o => (
              <div key={o.id} data-testid={`membership-order-row-${o.id}`} className="flex items-center justify-between rounded-lg border border-zinc-100 px-4 py-2">
                <div>
                  <p className="text-sm text-zinc-700">{o.plan.name} · {o.orderNo}</p>
                  <p className="text-xs text-zinc-400">¥{(o.amountCents / 100).toFixed(2)} · <span data-testid={`membership-order-status-${o.id}`}>{o.status}</span> · {new Date(o.createdAt).toLocaleDateString()}</p>
                </div>
                {o.status === "pending" && <button data-testid={`membership-order-pay-${o.id}`} onClick={() => handlePay(o.id)} className="text-sm text-blue-600 hover:text-blue-800">模拟支付</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Redeem Code */}
      <div className="mt-8 rounded-xl border border-zinc-200 p-6">
        <h2 className="font-semibold text-zinc-900">会员码兑换</h2>
        <form onSubmit={handleRedeem} className="mt-3 flex gap-3">
          <input value={redeemCode} onChange={e => setRedeemCode(e.target.value)} placeholder="输入会员码" className="rounded-lg border border-zinc-300 px-3 py-2 text-sm flex-1 max-w-xs" />
          <button type="submit" className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800">兑换</button>
        </form>
        {redeemMsg && <p className="mt-2 text-sm text-amber-600">{redeemMsg}</p>}
      </div>
    </div>
  );
}
