"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    email: "",
    emailCode: "",
    password: "",
    referralCode: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [codeMsg, setCodeMsg] = useState("");

  function setField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSendCode() {
    if (!form.email) {
      setError("请先输入邮箱");
      return;
    }
    setSendingCode(true);
    setCodeMsg("");
    setError("");

    try {
      const res = await fetch("/api/auth/send-email-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, purpose: "register" }),
      });

      const data = await res.json();
      if (data.success) {
        setCodeMsg(
          data.data?.code
            ? `验证码已发送（开发模式: ${data.data.code}）`
            : "验证码已发送，请查收邮件",
        );
        // Auto-fill in dev mode
        if (data.data?.code) {
          setField("emailCode", data.data.code);
        }
      } else {
        setError(data.error?.message ?? "发送失败");
      }
    } catch {
      setError("网络错误");
    } finally {
      setSendingCode(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message ?? "注册失败");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("网络错误，请重试");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-zinc-900 text-center">注册</h1>
        <p className="mt-2 text-sm text-zinc-500 text-center">
          创建你的爆了么账号
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="username" className="block text-sm font-medium text-zinc-700">
              用户名
            </label>
            <input
              id="username"
              type="text"
              value={form.username}
              onChange={(e) => setField("username", e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              placeholder="4-20 位字符"
              minLength={4}
              maxLength={20}
              required
            />
          </div>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-700">
              邮箱
            </label>
            <div className="flex gap-2">
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                placeholder="your@email.com"
                required
              />
              <button
                type="button"
                onClick={handleSendCode}
                disabled={sendingCode}
                className="mt-1 shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50"
              >
                {sendingCode ? "发送中..." : "发送验证码"}
              </button>
            </div>
          </div>
          {codeMsg && (
            <p className="text-sm text-green-600">{codeMsg}</p>
          )}
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-zinc-700">
              验证码
            </label>
            <input
              id="code"
              type="text"
              value={form.emailCode}
              onChange={(e) => setField("emailCode", e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              placeholder="6 位数字"
              required
            />
          </div>
          <div>
            <label htmlFor="reg-password" className="block text-sm font-medium text-zinc-700">
              密码
            </label>
            <input
              id="reg-password"
              type="password"
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              placeholder="至少 8 位"
              minLength={8}
              required
            />
          </div>
          <div>
            <label htmlFor="referral" className="block text-sm font-medium text-zinc-700">
              邀请码 <span className="text-zinc-400">(选填)</span>
            </label>
            <input
              id="referral"
              type="text"
              value={form.referralCode}
              onChange={(e) => setField("referralCode", e.target.value)}
              className="mt-1 block w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              placeholder="没有可不填"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {loading ? "注册中..." : "注册"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          已有账号？{" "}
          <Link href="/login" className="font-medium text-zinc-900 hover:underline">
            去登录
          </Link>
        </p>
      </div>
    </div>
  );
}
