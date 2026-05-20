"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type AuthMode = "login" | "register";
type Direction = "forward" | "back";

export function AuthShell({
  initialMode,
  loginForm,
  registerForm,
}: {
  initialMode: AuthMode;
  loginForm: (onSuccess: () => void) => ReactNode;
  registerForm: (onSuccess: () => void) => ReactNode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [direction, setDirection] = useState<Direction>(initialMode === "register" ? "forward" : "back");
  const [checking, setChecking] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((b) => {
        if (b.success) window.location.replace("/dashboard");
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  function switchTo(target: AuthMode) {
    if (target === mode || leaving || switching) return;
    setSwitching(true);
    // Brief feedback delay before actually switching
    setTimeout(() => {
      setDirection(target === "register" ? "forward" : "back");
      setMode(target);
      router.replace(target === "login" ? "/login" : "/register", { scroll: false });
      setSwitching(false);
    }, 140);
  }

  function exitToDashboard() {
    setLeaving(true);
    window.setTimeout(() => {
      window.location.replace("/dashboard");
    }, 220);
  }

  if (checking) {
    return (
      <div className="glass-page auth-center-page">
        <p className="text-sm text-zinc-400">加载中...</p>
      </div>
    );
  }

  return (
    <div
      className={`glass-page auth-center-page ${mode === "login" ? "login-mode" : "register-mode"} ${
        direction === "forward" ? "auth-forward" : "auth-back"
      } ${leaving ? "auth-leaving" : ""}`}
    >
      <div className="auth-center-light" />
      <div className="auth-center-shell" aria-live="polite">
        <div
          data-mode="login"
          aria-hidden={mode !== "login"}
          className={`auth-form-card auth-single-card ${mode === "login" ? "forward" : "back"}`}
        >
          <div className="glass-card auth-card-inner p-8">
            {loginForm(exitToDashboard)}
            <p className="mt-6 text-center text-sm text-zinc-500">
              还没有账号？{" "}
              <button type="button" onClick={() => switchTo("register")} className={`auth-switch-link ${switching ? "is-switching" : ""}`}>
                去注册
              </button>
            </p>
          </div>
        </div>

        <div
          data-mode="register"
          aria-hidden={mode !== "register"}
          className={`auth-form-card auth-single-card ${mode === "register" ? "forward" : "back"}`}
        >
          <div className="glass-card auth-card-inner p-8">
            {registerForm(exitToDashboard)}
            <p className="mt-6 text-center text-sm text-zinc-500">
              已有账号？{" "}
              <button type="button" onClick={() => switchTo("login")} className={`auth-switch-link ${switching ? "is-switching" : ""}`}>
                去登录
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
