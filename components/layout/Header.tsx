import { cookies } from "next/headers";
import Link from "next/link";
import { LogoutButton } from "./LogoutButton";

async function getUserInfo() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("baoleme_session")?.value;
    if (!token) return null;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: `baoleme_session=${token}` }, cache: "no-store" });
    const data = await res.json();
    if (!data.success) return null;
    return data.data;
  } catch { return null; }
}

export async function Header() {
  const sessionData = await getUserInfo();

  return (
    <header className="sticky top-4 z-50 px-4">
      <div className="mx-auto max-w-6xl">
        <div className="glass-nav flex items-center justify-between h-14 px-5">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <span className="glass-icon-tile w-8 h-8 rounded-lg text-sm bg-gradient-to-br from-sky-400 to-teal-400 text-white font-bold">爆</span>
            <span className="text-lg font-bold text-zinc-800 tracking-tight">爆了么</span>
          </Link>

          {/* Nav pills (logged in) */}
          {sessionData ? (
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { href: "/dashboard", label: "工作台" },
                { href: "/materials", label: "素材" },
                { href: "/prompts", label: "提示词" },
                { href: "/writing", label: "创作" },
                { href: "/formatter", label: "排版" },
                { href: "/official-accounts", label: "公众号" },
                { href: "/membership", label: "会员" },
                { href: "/referral", label: "推广" },
                ...(sessionData.user?.role === "admin" || sessionData.user?.role === "super_admin"
                  ? [{ href: "/admin", label: "后台" }] : []),
              ].map(({ href, label }) => (
                <Link key={href} href={href}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    label === "后台"
                      ? "text-amber-600 bg-amber-50/70 hover:bg-amber-100/70"
                      : "text-zinc-600 hover:text-zinc-900 hover:bg-white/60"
                  }`}
                >{label}</Link>
              ))}
              <span className="ml-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-sky-400/15 to-teal-400/15 text-teal-700 text-xs font-semibold shrink-0">
                {sessionData.user?.username ?? "用户"}
              </span>
              <LogoutButton />
            </div>
          ) : (
            <nav className="flex items-center gap-3 text-sm">
              <Link href="/login" className="text-zinc-600 hover:text-zinc-900 font-medium">登录</Link>
              <Link href="/register" className="glass-btn-primary !text-sm !py-1.5 !px-4">注册</Link>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
