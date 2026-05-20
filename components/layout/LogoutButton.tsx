"use client";

export function LogoutButton() {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.replace("/login");
  }

  return (
    <button
      onClick={handleLogout}
      className="text-xs text-zinc-400 hover:text-zinc-600 ml-2 shrink-0"
    >
      退出
    </button>
  );
}
