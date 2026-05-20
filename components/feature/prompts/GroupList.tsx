"use client";

import { useState } from "react";
import { useModal } from "@/components/ui/modal";

type Group = {
  id: string;
  name: string;
  description: string | null;
};

export function GroupList({
  groups,
  selectedId,
  onSelect,
  onRefresh,
}: {
  groups: Group[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onRefresh: () => void;
}) {
  const modal = useModal();
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function handleCreate() {
    if (!newName.trim()) return;
    await fetch("/api/prompts/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName.trim() }) });
    setNewName(""); setAdding(false); onRefresh();
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) return;
    await fetch("/api/prompts/groups", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name: editName.trim() }) });
    setEditingId(null); onRefresh();
  }

  async function handleDelete(id: string) {
    if (!(await modal.open({ title: "删除分组", message: "确定删除此分组？如分组内有提示词则无法删除。", confirmLabel: "删除", variant: "danger" }))) return;
    const res = await fetch(`/api/prompts/groups?id=${id}`, { method: "DELETE" });
    const body = await res.json();
    if (!body.success) { await modal.open({ title: "删除失败", message: body.error?.message ?? "删除失败" }); return; }
    if (selectedId === id) onSelect(null);
    onRefresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">分组</h3>
        <button onClick={() => setAdding(true)} className="text-xs text-sky-500 hover:text-sky-700 font-medium">+ 新建</button>
      </div>
      <ul className="space-y-0.5">
        <li>
          <button onClick={() => onSelect(null)}
            className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${selectedId === null ? "bg-white/60 text-zinc-900 font-medium" : "text-zinc-600 hover:bg-white/30"}`}>
            全部提示词
          </button>
        </li>
        {groups.map(g => (
          <li key={g.id}>
            {editingId === g.id ? (
              <div className="space-y-2 py-1">
                <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full text-sm glass-input !py-1.5 !px-3 !rounded-xl" placeholder="分组名称"
                  onKeyDown={e => e.key === "Enter" && handleUpdate(g.id)} />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingId(null)} className="text-xs text-zinc-500 hover:text-zinc-700">取消</button>
                  <button onClick={() => handleUpdate(g.id)} className="text-xs font-medium text-teal-600">保存</button>
                </div>
              </div>
            ) : (
              <div className="group flex items-center">
                <button onClick={() => onSelect(g.id)}
                  className={`flex-1 text-left px-3 py-2 rounded-xl text-sm transition-colors ${selectedId === g.id ? "bg-white/60 text-zinc-900 font-medium" : "text-zinc-600 hover:bg-white/30"}`}>
                  {g.name}
                </button>
                <div className="hidden group-hover:flex gap-1 pr-2">
                  <button onClick={() => { setEditingId(g.id); setEditName(g.name); }} className="text-xs text-zinc-400 hover:text-zinc-600">编辑</button>
                  <button onClick={() => handleDelete(g.id)} className="text-xs text-red-400 hover:text-red-600">删除</button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {adding && (
        <div className="mt-2 space-y-2">
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="分组名称"
            className="w-full text-sm glass-input !py-1.5 !px-3 !rounded-xl"
            onKeyDown={e => e.key === "Enter" && handleCreate()} />
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="text-xs text-zinc-500 hover:text-zinc-700">取消</button>
            <button onClick={handleCreate} className="text-xs font-medium text-teal-600">确定</button>
          </div>
        </div>
      )}
    </div>
  );
}
