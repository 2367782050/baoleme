"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(b => { if (b.success) window.location.replace("/dashboard"); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account, password }) });
      const data = await res.json();
      if (!data.success) { setError(data.error?.message ?? "登录失败，请检查账号密码"); setLoading(false); return; }
      window.location.replace("/dashboard");
    } catch { setError("网络错误，请重试"); setLoading(false); }
  }

  if (checking) return <div className="glass-page flex min-h-screen items-center justify-center"><p className="text-sm text-zinc-400">加载中...</p></div>;

  return (
    <div className="glass-page depth-page flex min-h-screen items-center justify-center px-6">
      <div className="glass-card p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-zinc-900 text-center">登录</h1>
        <p className="mt-2 text-sm text-zinc-500 text-center">登录你的爆了么账号</p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error && <div className="rounded-2xl bg-red-50/70 backdrop-blur px-4 py-3 text-sm text-red-600">{error}</div>}
          <div><label htmlFor="account" className="block text-sm font-medium text-zinc-700 mb-1">账号</label>
            <input id="account" type="text" value={account} onChange={e => setAccount(e.target.value)} className="w-full glass-input text-sm" placeholder="用户名或邮箱" required /></div>
          <div><label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-1">密码</label>
            <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full glass-input text-sm" placeholder="输入密码" required /></div>
          <button type="submit" disabled={loading} className="glass-btn-primary w-full">{loading ? "登录中..." : "登录"}</button>
        </form>
        <p className="mt-6 text-center text-sm text-zinc-500">还没有账号？ <Link href="/register" className="font-medium text-teal-600 hover:underline">去注册</Link></p>
      </div>
    </div>
  );
}
