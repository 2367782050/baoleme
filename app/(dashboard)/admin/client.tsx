"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

const SIDEBAR_ITEMS = ["概览","用户管理","会员管理","订单管理","提现审核","AI 任务"] as const;
type Tab = (typeof SIDEBAR_ITEMS)[number];

const SIDEBAR_ICONS: Record<Tab, string> = {
  "概览": "/ui-assets/admin-overview.png",
  "用户管理": "/ui-assets/admin-users.png",
  "会员管理": "/ui-assets/admin-membership.png",
  "订单管理": "/ui-assets/admin-orders.png",
  "提现审核": "/ui-assets/admin-withdrawals.png",
  "AI 任务": "/ui-assets/admin-ai-jobs.png",
};

export function AdminClient() {
  const [tab,setTab]=useState<Tab>("概览"); const [error,setError]=useState("");
  const [users,setUsers]=useState<Record<string,unknown>[]>([]);
  const [orders,setOrders]=useState<Record<string,unknown>[]>([]);
  const [withdrawals,setWithdrawals]=useState<Record<string,unknown>[]>([]);
  const [pj,setPj]=useState<Record<string,unknown>[]>([]);
  const [aj,setAj]=useState<Record<string,unknown>[]>([]);
  const [keyword,setKeyword]=useState("");

  async function refreshList(url:string,setter:(d:Record<string,unknown>[])=>void){const r=await fetch(url);const b=await r.json();if(b.success)setter(b.data.items)}
  useEffect(()=>{let c=false;async function load(){const[uR,oR,wR,pR,aR]=await Promise.allSettled([fetch("/api/admin/users?pageSize=100").then(r=>r.json()),fetch("/api/admin/orders?pageSize=100").then(r=>r.json()),fetch("/api/admin/withdrawals?pageSize=100").then(r=>r.json()),fetch("/api/admin/jobs/prompts").then(r=>r.json()),fetch("/api/admin/jobs/articles").then(r=>r.json())]);if(c)return;const ub=uR.status==="fulfilled"?uR.value:null;if(!ub?.success){setError(ub?.error?.message??"无权限");return}setUsers(ub.data.items);if(oR.status==="fulfilled"&&oR.value.data)setOrders(oR.value.data.items);if(wR.status==="fulfilled"&&wR.value.data)setWithdrawals(wR.value.data.items);if(pR.status==="fulfilled"&&pR.value.data)setPj(pR.value.data.items);if(aR.status==="fulfilled"&&aR.value.data)setAj(aR.value.data.items)}load();return()=>{c=true}},[]);

  async function toggleUserStatus(id:string,status:string){const ns=status==="active"?"disabled":"active";await fetch(`/api/admin/users/${id}/status`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:ns})});await refreshList("/api/admin/users?pageSize=100",setUsers)}
  async function generateCodes(){const pid=prompt("套餐 ID:");if(!pid)return;const cnt=prompt("数量:");if(!cnt)return;const r=await fetch("/api/admin/membership/codes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({planId:pid,count:Number(cnt)})});const b=await r.json();alert(b.success?`已生成: ${b.data.codes.join(", ")}`:(b.error?.message??"失败"))}
  async function reviewW(id:string,action:string){await fetch(`/api/admin/withdrawals/${id}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action})});await refreshList("/api/admin/withdrawals?pageSize=100",setWithdrawals)}
  async function openTab(t:Tab){setTab(t);if(t==="用户管理")await refreshList("/api/admin/users?pageSize=100",setUsers);if(t==="订单管理")await refreshList("/api/admin/orders?pageSize=100",setOrders);if(t==="提现审核")await refreshList("/api/admin/withdrawals?pageSize=100",setWithdrawals);if(t==="AI 任务"){await refreshList("/api/admin/jobs/prompts",setPj);await refreshList("/api/admin/jobs/articles",setAj)}}

  const filteredUsers = keyword ? users.filter((u:Record<string,unknown>)=>String(u.username).includes(keyword)||String(u.email).includes(keyword)) : users;

  if(error&&tab!=="概览") return <div className="admin-glass-page min-h-screen px-6 py-12 text-sm text-red-500">{error}</div>;

  return (
    <div className="admin-glass-page min-h-screen pt-6 pb-20 px-6">
      <div className="mx-auto max-w-7xl flex flex-col lg:flex-row gap-6">
        {/* Sidebar */}
        <div className="lg:w-52 shrink-0">
          <div className="glass-sidebar p-3 sticky top-24">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider px-2 mb-2">后台运营</h2>
            <nav className="space-y-0.5">
              {SIDEBAR_ITEMS.map(t => (
                <button key={t} onClick={()=>openTab(t)}
                  className={`glass-sidebar-item w-full ${tab===t?"active":""}`}>
                  <Image src={SIDEBAR_ICONS[t]} alt={t} width={32} height={32} className="shrink-0" /> {t}
                </button>
              ))}
            </nav>

            {/* Withdrawal queue mini panel */}
            <div className="mt-6 p-3 rounded-2xl bg-amber-50/50 border border-amber-100/50">
              <p className="text-xs font-medium text-amber-700 mb-1">提现申请</p>
              <p className="text-2xl font-bold text-amber-600">{withdrawals.filter((w:Record<string,unknown>)=>w.status==="pending").length}</p>
              <p className="text-[10px] text-amber-500">待审核</p>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          {tab==="概览"&&<div className="space-y-6">
            <h1 className="text-2xl font-bold text-zinc-900">概览</h1>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              {[{label:"用户",v:users.length,color:"text-sky-600"},{label:"订单",v:orders.length,color:"text-teal-600"},{label:"待审提现",v:withdrawals.filter((w:Record<string,unknown>)=>w.status==="pending").length,color:"text-amber-600"},{label:"提示词任务",v:pj.length,color:"text-violet-600"},{label:"文章任务",v:aj.length,color:"text-rose-600"}].map(({label,v,color})=><div key={label} className="glass-tile p-5"><p className={`text-2xl font-bold ${color}`}>{v}</p><p className="text-xs text-zinc-500 mt-1">{label}</p></div>)}</div>
          </div>}

          {tab==="用户管理"&&<div data-testid="admin-users-panel">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-zinc-900">用户管理</h2>
              <input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="搜索用户名/邮箱..." className="glass-input max-w-xs text-sm" />
            </div>
            <div className="glass-card overflow-hidden">
              <table className="glass-table"><thead><tr><th>用户名</th><th>邮箱</th><th>角色</th><th>状态</th><th>操作</th></tr></thead>
                <tbody>{filteredUsers.map((u:Record<string,unknown>)=><tr key={String(u.id)} data-testid={`admin-user-row-${u.id}`}>
                  <td className="font-medium">{String(u.username)}</td><td className="text-zinc-500">{String(u.email)}</td><td>{String(u.role)}</td>
                  <td><span data-testid={`admin-user-status-${u.id}`} className={u.status==="active"?"badge-ok":"badge-err"}>{String(u.status)}</span></td>
                  <td><button data-testid={`admin-user-toggle-${u.id}`} onClick={()=>toggleUserStatus(String(u.id),String(u.status))} className="text-xs font-medium text-sky-600 hover:text-sky-700">{u.status==="active"?"禁用":"启用"}</button></td>
                </tr>)}</tbody></table>
            </div>
          </div>}

          {tab==="会员管理"&&<div data-testid="admin-membership-panel">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">会员码管理</h2>
            <div className="glass-card p-6"><button onClick={generateCodes} className="glass-btn-primary">生成会员码</button></div>
          </div>}

          {tab==="订单管理"&&<div data-testid="admin-orders-panel">
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">订单管理</h2>
            <div className="glass-card overflow-hidden">
              <table className="glass-table"><thead><tr><th>订单号</th><th>用户</th><th>套餐</th><th>金额</th><th>状态</th><th>时间</th></tr></thead>
                <tbody>{orders.map((o:Record<string,unknown>)=><tr key={String(o.id)}><td className="font-mono text-xs text-zinc-500">{String(o.orderNo)}</td><td>{(o.user as Record<string,unknown>)?.username as string??""}</td><td>{(o.plan as Record<string,unknown>)?.name as string??""}</td><td>¥{Number(o.amountCents)/100}</td><td><span className={o.status==="paid"?"badge-ok":"badge-warn"}>{String(o.status)}</span></td><td className="text-xs text-zinc-400">{new Date(String(o.createdAt)).toLocaleDateString()}</td></tr>)}</tbody></table>
            </div>
          </div>}

          {tab==="提现审核"&&<div>
            <h2 className="text-lg font-semibold text-zinc-900 mb-4">提现审核</h2>
            <div className="glass-card overflow-hidden">
              <table className="glass-table"><thead><tr><th>用户</th><th>金额</th><th>支付宝</th><th>状态</th><th>时间</th><th>操作</th></tr></thead>
                <tbody>{withdrawals.map((w:Record<string,unknown>)=><tr key={String(w.id)} data-testid={`admin-withdrawal-row-${w.id}`}>
                  <td>{(w.user as Record<string,unknown>)?.username as string??""}</td><td>¥{Number(w.amountCents)/100}</td><td className="text-zinc-500">{String(w.alipayName)}</td>
                  <td><span className={w.status==="pending"?"badge-warn":w.status==="approved"?"badge-ok":"badge-muted"}>{String(w.status)}</span></td>
                  <td className="text-xs text-zinc-400">{new Date(String(w.createdAt)).toLocaleDateString()}</td>
                  <td>{w.status==="pending"&&<div className="flex gap-2"><button onClick={()=>reviewW(String(w.id),"approved")} className="text-xs font-medium text-green-600">通过</button><button onClick={()=>reviewW(String(w.id),"rejected")} className="text-xs font-medium text-red-500">驳回</button></div>}</td>
                </tr>)}</tbody></table>
            </div>
          </div>}

          {tab==="AI 任务"&&<div data-testid="admin-ai-panel" className="space-y-6">
            <div className="glass-card p-5">
              <h3 className="font-semibold text-zinc-900 mb-3">提示词生成任务</h3>
              <div className="space-y-1">{pj.slice(0,20).map((j:Record<string,unknown>)=><div key={String(j.id)} className="flex items-center justify-between text-xs py-2 border-b border-black/5 last:border-0"><span>{(j.user as Record<string,unknown>)?.username as string??""}</span><span className={j.status==="failed"?"badge-err":j.status==="completed"?"badge-ok":"badge-info"}>{String(j.status)}</span><span className="text-zinc-400 truncate max-w-xs">{j.errorMessage?String(j.errorMessage).substring(0,60):""}</span></div>)}</div>
            </div>
            <div className="glass-card p-5">
              <h3 className="font-semibold text-zinc-900 mb-3">文章生成任务</h3>
              <div className="space-y-1">{aj.slice(0,20).map((j:Record<string,unknown>)=><div key={String(j.id)} className="flex items-center justify-between text-xs py-2 border-b border-black/5 last:border-0"><span>{(j.user as Record<string,unknown>)?.username as string??""}</span><span className="text-zinc-400">{(j.article as Record<string,unknown>)?.title as string??""}</span><span className={j.status==="failed"?"badge-err":j.status==="completed"?"badge-ok":"badge-info"}>{String(j.status)}</span></div>)}</div>
            </div>
          </div>}
        </div>
      </div>
    </div>
  );
}
