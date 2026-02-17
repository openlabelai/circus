"use client";

import { useState, useRef, useEffect } from "react";
import { useProject } from "@/lib/project-context";
import { createProject } from "@/lib/api";
import Link from "next/link";

const PROJECT_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

export default function ProjectSwitcher() {
  const { projects, activeProject, setActiveProject, refreshProjects, loading } = useProject();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
    const created = await createProject({ name: newName.trim(), color });
    await refreshProjects();
    setActiveProject(created);
    setNewName("");
    setCreating(false);
    setOpen(false);
  };

  if (loading) {
    return <div className="px-3 py-2 text-xs text-gray-500">Loading...</div>;
  }

  return (
    <div ref={ref} className="relative px-1 mb-1">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-gray-800 transition-colors text-left"
      >
        <span
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: activeProject?.color || "#6366f1" }}
        />
        <span className="truncate flex-1 text-gray-200">
          {activeProject?.name || "Select project"}
        </span>
        <svg className="w-3 h-3 text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {projects.map((p) => (
            <div
              key={p.id}
              className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-700 transition-colors ${
                p.id === activeProject?.id ? "bg-gray-700/50" : ""
              }`}
            >
              <button
                onClick={() => {
                  setActiveProject(p);
                  setOpen(false);
                }}
                className="flex items-center gap-2 flex-1 min-w-0 text-left"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: p.color || "#6366f1" }}
                />
                <span className="truncate flex-1">{p.name}</span>
                <span className="text-xs text-gray-500">{p.persona_count}p</span>
              </button>
              <Link
                href={`/projects/${p.id}`}
                onClick={() => setOpen(false)}
                className="text-gray-500 hover:text-gray-300 flex-shrink-0"
                title="Project settings"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>
            </div>
          ))}

          <div className="border-t border-gray-700">
            {creating ? (
              <div className="p-2 flex gap-1">
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="Project name"
                  className="flex-1 bg-gray-900 border border-gray-600 rounded px-2 py-1 text-xs"
                />
                <button
                  onClick={handleCreate}
                  className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-xs"
                >
                  Add
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="w-full px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-700 transition-colors text-left"
              >
                + New Project
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
