"use client";

import { ModalProvider } from "@/components/ui/modal";

export function ClientShell({ children }: { children: React.ReactNode }) {
  return <ModalProvider>{children}</ModalProvider>;
}
