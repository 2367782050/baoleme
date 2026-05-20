"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type AuthMode = "login" | "register";

const MINI_CARDS = [
  { icon: "/ui-assets/tool-viral-topic.png", title: "素材发现", desc: "全平台爆款内容实时追踪" },
  { icon: "/ui-assets/tool-ai-writing.png", title: "智能创作", desc: "AI 辅助高质量写作" },
  { icon: "/ui-assets/tool-image-tool.png", title: "一键排版", desc: "文章转精美公众号排版" },
];

export function AuthShell({
  initialMode,
  loginForm,
  registerForm,
}: {
  initialMode: AuthMode;
  loginForm: ReactNode;
  registerForm: ReactNode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [checking, setChecking] = useState(true);

  // Redirect if already logged in
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((b) => { if (b.success) window.location.replace("/dashboard"); })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  function switchTo(target: AuthMode) {
    setMode(target);
    router.replace(target === "login" ? "/login" : "/register", { scroll: false });
  }

  if (checking) {
    return (
      <div className="glass-page flex min-h-screen items-center justify-center">
        <p className="text-sm text-zinc-400">加载中...</p>
      </div>
    );
  }

  return (
    <div className={`auth-shell ${mode === "login" ? "login-mode" : "register-mode"}`}>
      {/* Left: brand */}
      <div className="auth-brand">
        <div className="relative z-10 max-w-md">
          <div className="flex items-center gap-2.5 mb-6">
            <span className="w-9 h-9 rounded-lg bg-gradient-to-br from-sky-400 to-teal-400 flex items-center justify-center text-white font-bold text-sm">爆</span>
            <span className="text-2xl font-extrabold text-zinc-900 tracking-tight">爆了么</span>
          </div>
          <h2 className="text-xl font-bold text-zinc-800">
            {mode === "login" ? "欢迎回来" : "开启创作工作台"}
          </h2>
          <p className="mt-2 text-sm text-zinc-500 leading-relaxed">
            {mode === "login" ? "登录你的账号，继续创作爆款内容。" : "注册账号，开始你的自媒体创作之旅。"}
          </p>
          <div className="auth-mini-cards">
            {MINI_CARDS.map((c) => (
              <div key={c.title} className="auth-mini-card">
                <Image src={c.icon} alt={c.title} width={28} height={28} className="shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-zinc-700">{c.title}</p>
                  <p className="text-xs text-zinc-400">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: forms */}
      <div className="auth-form-area">
        <div
          data-mode="login"
          className={`auth-form-card ${mode === "login" ? "forward" : "back"}`}
        >
          <div className="glass-card p-8">
            {loginForm}
            <p className="mt-6 text-center text-sm text-zinc-500">
              还没有账号？{" "}
              <button onClick={() => switchTo("register")} className="font-medium text-teal-600 hover:underline">
                去注册
              </button>
            </p>
          </div>
        </div>
        <div
          data-mode="register"
          className={`auth-form-card ${mode === "register" ? "forward" : "back"}`}
        >
          <div className="glass-card p-8">
            {registerForm}
            <p className="mt-6 text-center text-sm text-zinc-500">
              已有账号？{" "}
              <button onClick={() => switchTo("login")} className="font-medium text-teal-600 hover:underline">
                去登录
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
