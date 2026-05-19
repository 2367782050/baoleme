import { cookies } from "next/headers";
import Link from "next/link";

async function getUserInfo() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("baoleme_session")?.value;
    if (!token) return null;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Cookie: `baoleme_session=${token}` },
      cache: "no-store",
    });
    const data = await res.json();
    if (!data.success) return null;
    return data.data;
  } catch {
    return null;
  }
}

export async function Header() {
  const sessionData = await getUserInfo();

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <Link
          href="/"
          className="text-lg font-bold text-zinc-900 tracking-tight"
        >
          爆了么
        </Link>

        {sessionData ? (
          <nav className="flex items-center gap-4 text-sm text-zinc-600">
            <Link
              href="/dashboard"
              className="hover:text-zinc-900 transition-colors"
            >
              工作台
            </Link>
            <Link
              href="/materials"
              className="hover:text-zinc-900 transition-colors"
            >
              爆款素材
            </Link>
            <Link
              href="/prompts"
              className="hover:text-zinc-900 transition-colors"
            >
              提示词库
            </Link>
            <Link
              href="/writing"
              className="hover:text-zinc-900 transition-colors"
            >
              智能创作
            </Link>
            <Link
              href="/formatter"
              className="hover:text-zinc-900 transition-colors"
            >
              一键排版
            </Link>
            <Link
              href="/official-accounts"
              className="hover:text-zinc-900 transition-colors"
            >
              公众号
            </Link>
            <Link
              href="/referral"
              className="hover:text-zinc-900 transition-colors"
            >
              推广
            </Link>
            {sessionData.user.role === "admin" || sessionData.user.role === "super_admin" ? (
              <Link href="/admin" className="text-amber-600 hover:text-amber-800 transition-colors">
                后台
              </Link>
            ) : null}
            <Link
              href="/membership"
              className="hover:text-zinc-900 transition-colors"
            >
              {sessionData.membership?.planName ?? "会员"}
            </Link>
            <span className="text-zinc-400">
              {sessionData.user.username}
            </span>
          </nav>
        ) : (
          <nav className="hidden sm:flex items-center gap-6 text-sm text-zinc-600">
            <Link
              href="/login"
              className="hover:text-zinc-900 transition-colors"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 transition-colors"
            >
              注册
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
