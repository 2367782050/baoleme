"use client";

import { useState } from "react";

export function LoginFormContent() {
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account, password }) });
      const data = await res.json();
      if (!data.success) { setError(data.error?.message ?? "登录失败，请检查账号密码"); setLoading(false); return; }
      window.location.replace("/dashboard");
    } catch { setError("网络错误，请重试"); setLoading(false); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 text-center">登录</h1>
      <p className="mt-2 text-sm text-zinc-500 text-center">登录你的爆了么账号</p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {error && <div className="auth-error rounded-2xl bg-red-50/70 backdrop-blur px-4 py-3 text-sm text-red-600">{error}</div>}
        <div><label htmlFor="account" className="block text-sm font-medium text-zinc-700 mb-1">账号</label>
          <input id="account" type="text" value={account} onChange={e => setAccount(e.target.value)} className="w-full glass-input text-sm" placeholder="用户名或邮箱" required /></div>
        <div><label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-1">密码</label>
          <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full glass-input text-sm" placeholder="输入密码" required /></div>
        <button type="submit" disabled={loading} className="glass-btn-primary w-full">{loading ? "登录中..." : "登录"}</button>
      </form>
    </div>
  );
}

export function RegisterFormContent() {
  const [form, setForm] = useState({ username: "", email: "", emailCode: "", password: "", referralCode: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeMsg, setCodeMsg] = useState("");

  function setField(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })); }

  async function handleSendCode() {
    if (!form.email) { setError("请先输入邮箱"); return; }
    setSendingCode(true); setCodeMsg(""); setError("");
    try {
      const res = await fetch("/api/auth/send-email-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.email, purpose: "register" }) });
      const data = await res.json();
      if (data.success) { setCodeMsg(data.data?.code ? `验证码已发送（开发模式: ${data.data.code}）` : "验证码已发送，请查收邮件"); if (data.data?.code) setField("emailCode", data.data.code); }
      else setError(data.error?.message ?? "发送失败");
    } catch { setError("网络错误"); }
    finally { setSendingCode(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!data.success) { setError(data.error?.message ?? "注册失败"); setLoading(false); return; }
      window.location.replace("/dashboard");
    } catch { setError("网络错误，请重试"); setLoading(false); }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900 text-center">注册</h1>
      <p className="mt-2 text-sm text-zinc-500 text-center">创建你的爆了么账号</p>
      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {error && <div className="auth-error rounded-2xl bg-red-50/70 backdrop-blur px-4 py-3 text-sm text-red-600">{error}</div>}
        <div><label htmlFor="username" className="block text-sm font-medium text-zinc-700 mb-1">用户名</label>
          <input id="username" type="text" value={form.username} onChange={e => setField("username", e.target.value)} className="w-full glass-input text-sm" placeholder="4-20 位字符" minLength={4} maxLength={20} required /></div>
        <div><label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-1">邮箱</label>
          <div className="flex gap-2"><input id="email" type="email" value={form.email} onChange={e => setField("email", e.target.value)} className="w-full glass-input text-sm" placeholder="your@email.com" required />
            <button type="button" onClick={handleSendCode} disabled={sendingCode} className="glass-btn-secondary !text-sm !py-2 shrink-0">{sendingCode ? "发送中..." : "发送验证码"}</button></div></div>
        {codeMsg && <div className="auth-status rounded-2xl bg-green-50/70 backdrop-blur px-4 py-2 text-sm text-green-700">{codeMsg}</div>}
        <div><label htmlFor="code" className="block text-sm font-medium text-zinc-700 mb-1">验证码</label>
          <input id="code" type="text" value={form.emailCode} onChange={e => setField("emailCode", e.target.value)} className="w-full glass-input text-sm" placeholder="6 位数字" required /></div>
        <div><label htmlFor="reg-password" className="block text-sm font-medium text-zinc-700 mb-1">密码</label>
          <input id="reg-password" type="password" value={form.password} onChange={e => setField("password", e.target.value)} className="w-full glass-input text-sm" placeholder="至少 8 位" minLength={8} required /></div>
        <div><label htmlFor="referral" className="block text-sm font-medium text-zinc-700 mb-1">邀请码 <span className="text-zinc-400">(选填)</span></label>
          <input id="referral" type="text" value={form.referralCode} onChange={e => setField("referralCode", e.target.value)} className="w-full glass-input text-sm" placeholder="没有可不填" /></div>
        <button type="submit" disabled={loading} className="glass-btn-primary w-full">{loading ? "注册中..." : "注册"}</button>
      </form>
    </div>
  );
}
