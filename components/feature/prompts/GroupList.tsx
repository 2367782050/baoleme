"use client";

import { useState } from "react";

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
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function handleCreate() {
    if (!newName.trim()) return;
    await fetch("/api/prompts/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setNewName("");
    setAdding(false);
    onRefresh();
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) return;
    await fetch("/api/prompts/groups", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName.trim() }),
    });
    setEditingId(null);
    onRefresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("确定删除此分组？如分组内有提示词则无法删除。")) return;
    const res = await fetch(`/api/prompts/groups?id=${id}`, { method: "DELETE" });
    const body = await res.json();
    if (!body.success) {
      alert(body.error?.message ?? "删除失败");
      return;
    }
    if (selectedId === id) onSelect(null);
    onRefresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">分组</h3>
        <button
          onClick={() => setAdding(true)}
          className="text-xs text-zinc-400 hover:text-zinc-600"
        >
          + 新建
        </button>
      </div>

      <ul className="space-y-0.5">
        <li>
          <button
            onClick={() => onSelect(null)}
            className={`w-full text-left px-3 py-1.5 rounded text-sm transition-colors ${
              selectedId === null
                ? "bg-zinc-100 text-zinc-900 font-medium"
                : "text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            全部提示词
          </button>
        </li>
        {groups.map((g) => (
          <li key={g.id}>
            {editingId === g.id ? (
              <div className="px-3 py-1 flex gap-1">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 text-sm border border-zinc-300 rounded px-2 py-0.5"
                  onKeyDown={(e) => e.key === "Enter" && handleUpdate(g.id)}
                />
                <button onClick={() => handleUpdate(g.id)} className="text-xs text-green-600">保存</button>
                <button onClick={() => setEditingId(null)} className="text-xs text-zinc-400">取消</button>
              </div>
            ) : (
              <div className="group flex items-center">
                <button
                  onClick={() => onSelect(g.id)}
                  className={`flex-1 text-left px-3 py-1.5 rounded text-sm transition-colors ${
                    selectedId === g.id
                      ? "bg-zinc-100 text-zinc-900 font-medium"
                      : "text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  {g.name}
                </button>
                <div className="hidden group-hover:flex gap-1 pr-2">
                  <button
                    onClick={() => { setEditingId(g.id); setEditName(g.name); }}
                    className="text-xs text-zinc-400 hover:text-zinc-600"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(g.id)}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    删除
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {adding && (
        <div className="mt-2 flex gap-1">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="分组名称"
            className="flex-1 text-sm border border-zinc-300 rounded px-2 py-1"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button onClick={handleCreate} className="text-sm text-green-600 px-2">确定</button>
          <button onClick={() => setAdding(false)} className="text-sm text-zinc-400">取消</button>
        </div>
      )}
    </div>
  );
}
