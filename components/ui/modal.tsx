"use client";

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";

type ModalOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
};

type ModalState = ModalOptions & {
  id: number;
  resolve: (value: boolean) => void;
};

let nextId = 0;

const ModalContext = createContext<{
  open: (opts: ModalOptions) => Promise<boolean>;
} | null>(null);

export function useModal() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("useModal must be used within ModalProvider");
  return ctx;
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modals, setModals] = useState<ModalState[]>([]);

  const open = useCallback((opts: ModalOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      const id = nextId++;
      setModals((prev) => [...prev, { ...opts, id, resolve }]);
    });
  }, []);

  function close(id: number, result: boolean) {
    const modal = modals.find((m) => m.id === id);
    if (modal) modal.resolve(result);
    setModals((prev) => prev.filter((m) => m.id !== id));
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && modals.length > 0) {
        setModals((prev) => {
          const last = prev[prev.length - 1];
          if (last) last.resolve(false);
          return prev.slice(0, -1);
        });
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modals.length]);

  return (
    <ModalContext.Provider value={{ open }}>
      {children}
      {modals.map((m) => (
        <div
          key={m.id}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/25 backdrop-blur-sm modal-backdrop"
          onClick={() => close(m.id, false)}
        >
          <div
            className="glass-card p-6 w-full max-w-sm mx-4 modal-float"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-zinc-900">{m.title}</h3>
            <p className="mt-2 text-sm text-zinc-600">{m.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => close(m.id, false)}
                className="glass-btn-secondary !text-sm !py-2 !px-5"
              >
                {m.cancelLabel ?? "取消"}
              </button>
              <button
                onClick={() => close(m.id, true)}
                className={m.variant === "danger" ? "glass-btn-danger !text-sm !py-2 !px-5" : "glass-btn-primary !text-sm !py-2 !px-5"}
              >
                {m.confirmLabel ?? "确定"}
              </button>
            </div>
          </div>
        </div>
      ))}
    </ModalContext.Provider>
  );
}
