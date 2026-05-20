"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

type Account = { id: string; platform: string; name: string; avatarUrl: string|null; domainName: string|null; avgTopReadCount: number; avgReadCount: number; postCountDaily: number|string; likeCountTotal: number; originalIndex: number|string; rank: number; isFavorited: boolean; };

export function AccountList({ platform = "wechat", title = "公众号榜单" }: { platform?: string; title?: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [keyword, setKeyword] = useState("");
  const pageSize = 20;

  useEffect(() => { let c = false; async function load() { setLoading(true); setError(""); try { const p = new URLSearchParams(); if(platform) p.set("platform",platform); if(keyword) p.set("keyword",keyword); p.set("page",String(page)); p.set("pageSize",String(pageSize)); p.set("sortBy","rank"); p.set("sortOrder","asc"); const r = await fetch(`/api/material/accounts?${p}`); const b = await r.json(); if(c) return; if(!b.success){setError(b.error?.message??"加载失败");return} setAccounts(b.data.items); setTotal(b.data.total); } catch { if(!c) setError("网络错误"); } finally { if(!c) setLoading(false); } } load(); return () => { c = true; }; }, [platform, keyword, page]);

  async function handleFavorite(accountId: string, f: boolean) { if(f) return; try { const r = await fetch("/api/material/favorites",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({targetType:"account",targetId:accountId})}); const b = await r.json(); if(b.success) setAccounts(prev=>prev.map(a=>a.id===accountId?{...a,isFavorited:true}:a)); } catch {} }

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900 mb-4">{title}</h2>
      <div className="flex flex-wrap gap-3 mb-4">
        <input value={keyword} onChange={e=>{setKeyword(e.target.value);setPage(1)}} placeholder="搜索关键词..." className="glass-input py-2 text-sm" />
      </div>

      {loading && <p className="text-sm text-zinc-400 py-8">加载中...</p>}
      {error && <p className="text-sm text-red-500 py-8">{error}</p>}
      {!loading && !error && accounts.length === 0 && <p className="text-sm text-zinc-400 py-8">暂无数据</p>}

      {!loading && !error && accounts.length > 0 && (
        <div className="glass-card overflow-x-auto p-4">
          <table className="w-full text-sm text-zinc-700">
            <thead><tr className="border-b border-zinc-100 text-left text-xs text-zinc-400 uppercase tracking-wider">
              <th className="py-3 pr-2">#</th><th className="py-3 pr-2">行业</th><th className="py-3 pr-2">头像</th><th className="py-3 pr-2">名称</th><th className="py-3 pr-2 text-right">头条阅读</th><th className="py-3 pr-2 text-right">均阅</th><th className="py-3 pr-2 text-right">发文</th><th className="py-3 pr-2 text-right">点赞</th><th className="py-3 pr-2 text-right">原创指数</th><th className="py-3">操作</th>
            </tr></thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a.id} className="border-b border-zinc-50 hover:bg-white/50 transition-colors">
                  <td className="py-2.5 pr-2 font-medium">{a.rank}</td>
                  <td className="py-2.5 pr-2 text-zinc-500">{a.domainName??"-"}</td>
                  <td className="py-2.5 pr-2">{a.avatarUrl ? <Image src={a.avatarUrl} alt="" width={28} height={28} className="rounded-full" /> : <div className="w-7 h-7 rounded-full bg-zinc-200" />}</td>
                  <td className="py-2.5 pr-2 font-medium text-zinc-900">{a.name}</td>
                  <td className="py-2.5 pr-2 text-right">{a.avgTopReadCount.toLocaleString()}</td>
                  <td className="py-2.5 pr-2 text-right">{a.avgReadCount.toLocaleString()}</td>
                  <td className="py-2.5 pr-2 text-right">{String(a.postCountDaily)}</td>
                  <td className="py-2.5 pr-2 text-right">{a.likeCountTotal.toLocaleString()}</td>
                  <td className="py-2.5 pr-2 text-right">{String(a.originalIndex)}</td>
                  <td className="py-2.5 space-x-2 whitespace-nowrap">
                    <button onClick={()=>handleFavorite(a.id,a.isFavorited)} className={`text-xs px-2.5 py-1 rounded-full font-medium ${a.isFavorited?"bg-amber-50 text-amber-600":"text-zinc-500 hover:text-zinc-700"}`}>{a.isFavorited?"已收藏":"收藏"}</button>
                    <Link href={`/writing?source=account&id=${a.id}&name=${encodeURIComponent(a.name)}`} className="text-xs px-2.5 py-1 rounded-full text-zinc-500 hover:text-zinc-700">引用</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > pageSize && (
        <div className="flex items-center justify-between mt-4 text-sm text-zinc-500">
          <span>共 {total} 条</span>
          <div className="flex gap-2">
            <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="glass-pill px-4 py-1.5 text-xs disabled:opacity-30">上一页</button>
            <span className="px-3 py-1">{page}/{Math.ceil(total/pageSize)}</span>
            <button disabled={page>=Math.ceil(total/pageSize)} onClick={()=>setPage(p=>p+1)} className="glass-pill px-4 py-1.5 text-xs disabled:opacity-30">下一页</button>
          </div>
        </div>
      )}
    </div>
  );
}
