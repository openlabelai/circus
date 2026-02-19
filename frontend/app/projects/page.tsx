"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProjects, createProject } from "@/lib/api";
import { useProject } from "@/lib/project-context";
import type { Project } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-gray-500/20 text-gray-400 border-gray-600",
  warming: "bg-yellow-500/20 text-yellow-400 border-yellow-700",
  active: "bg-green-500/20 text-green-400 border-green-700",
  paused: "bg-orange-500/20 text-orange-400 border-orange-700",
  completed: "bg-blue-500/20 text-blue-400 border-blue-700",
};

const PROJECT_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

export default function ProjectsPage() {
  const router = useRouter();
  const { setActiveProject, refreshProjects: refreshCtx } = useProject();
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const load = () => {
    getProjects().then((d) => setProjects(d.results || [])).catch(console.error);
  };

  useEffect(load, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    const color = PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
    await createProject({ name: newName.trim(), color });
    setNewName("");
    setCreating(false);
    load();
    refreshCtx();
  };

  const handleClick = (project: Project) => {
    setActiveProject(project);
    router.push(`/projects/${project.id}`);
  };

  // Timeline helpers
  const timelineInfo = (p: Project) => {
    if (!p.start_date && !p.end_date) return null;
    if (p.start_date && p.end_date) {
      const start = new Date(p.start_date).getTime();
      const end = new Date(p.end_date).getTime();
      const total = end - start;
      if (total > 0) {
        const elapsed = Math.max(0, Math.min(Date.now() - start, total));
        const pct = Math.round((elapsed / total) * 100);
        const daysLeft = Math.max(0, Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24)));
        return { pct, daysLeft };
      }
    }
    return null;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Projects</h2>
        <button
          onClick={() => setCreating(!creating)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium"
        >
          {creating ? "Cancel" : "+ New Project"}
        </button>
      </div>

      {creating && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Project Name</label>
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. SZA Campaign Q1"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium"
          >
            Create
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p) => {
          const tl = timelineInfo(p);
          return (
            <button
              key={p.id}
              onClick={() => handleClick(p)}
              className="bg-gray-900 border border-gray-800 rounded-lg p-5 text-left hover:border-gray-600 transition-colors group"
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                <h3 className="font-semibold text-lg truncate flex-1 group-hover:text-white">{p.name}</h3>
                <span className={`px-2 py-0.5 rounded text-xs font-medium border ${STATUS_COLORS[p.status] || ""}`}>
                  {p.status}
                </span>
              </div>

              {/* Campaign info */}
              {(p.target_platform || p.target_artist || p.genre || p.country) && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {p.target_platform && (
                    <span className="px-2 py-0.5 bg-indigo-900/40 border border-indigo-700/50 rounded text-xs text-indigo-300">
                      {p.target_platform}
                    </span>
                  )}
                  {p.target_artist && (
                    <span className="px-2 py-0.5 bg-pink-900/40 border border-pink-700/50 rounded text-xs text-pink-300">
                      {p.target_artist}
                    </span>
                  )}
                  {p.genre && (
                    <span className="px-2 py-0.5 bg-purple-900/40 border border-purple-700/50 rounded text-xs text-purple-300">
                      {p.genre}
                    </span>
                  )}
                  {p.country && (
                    <span className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-400">
                      {p.country}
                    </span>
                  )}
                </div>
              )}

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3 text-center mb-3">
                <div>
                  <div className="text-lg font-bold">{p.agent_count}</div>
                  <div className="text-xs text-gray-500">
                    Fans{p.target_persona_count > 0 && <span> / {p.target_persona_count}</span>}
                  </div>
                </div>
                <div>
                  <div className="text-lg font-bold">{p.task_count}</div>
                  <div className="text-xs text-gray-500">Tasks</div>
                </div>
                <div>
                  <div className="text-lg font-bold">{p.active_schedule_count}</div>
                  <div className="text-xs text-gray-500">Schedules</div>
                </div>
              </div>

              {/* Timeline bar */}
              {tl && (
                <div>
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>{p.start_date} — {p.end_date}</span>
                    <span>{tl.daysLeft}d left</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${tl.pct}%`, backgroundColor: p.color }}
                    />
                  </div>
                </div>
              )}

              {/* Description preview */}
              {p.description && (
                <p className="text-xs text-gray-500 mt-3 line-clamp-2">{p.description}</p>
              )}
            </button>
          );
        })}

        {projects.length === 0 && (
          <div className="col-span-full text-center text-gray-500 py-12">
            No projects yet. Create one to get started.
          </div>
        )}
      </div>
    </div>
  );
}
