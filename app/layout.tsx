import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { ClientShell } from "./client-shell";

export const metadata: Metadata = {
  title: "爆了么 - 自媒体爆款智能创作工作台",
  description: "自媒体爆款智能创作工作台：素材发现、AI 写作、一键排版。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col text-zinc-900" suppressHydrationWarning>
        <Header />
        <main className="flex-1"><ClientShell>{children}</ClientShell></main>
      </body>
    </html>
  );
}
