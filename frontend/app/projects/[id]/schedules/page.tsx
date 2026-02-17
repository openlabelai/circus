"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getSchedules,
  deleteSchedule,
  pauseSchedule,
  resumeSchedule,
} from "@/lib/api";
import type { ScheduledTask } from "@/lib/types";

const statusColors: Record<string, string> = {
  active: "bg-green-500/20 text-green-400",
  paused: "bg-yellow-500/20 text-yellow-400",
  expired: "bg-gray-500/20 text-gray-400",
};

function formatTrigger(s: ScheduledTask) {
  if (s.trigger_type === "cron") return `Cron: ${s.cron_expression}`;
  if (s.trigger_type === "interval") {
    const secs = s.interval_seconds;
    if (secs >= 3600) return `Every ${Math.floor(secs / 3600)}h`;
    if (secs >= 60) return `Every ${Math.floor(secs / 60)}m`;
    return `Every ${secs}s`;
  }
  if (s.trigger_type === "once") {
    return s.run_at ? `Once: ${new Date(s.run_at).toLocaleString()}` : "Once";
  }
  return "-";
}

export default function SchedulesPage() {
  const { id } = useParams<{ id: string }>();
  const [schedules, setSchedules] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const load = () => {
    getSchedules(id)
      .then((d) => setSchedules(d.results || []))
      .catch(console.error);
  };

  useEffect(load, [id]);

  const handleDelete = async (scheduleId: string) => {
    if (!confirm(`Delete schedule ${scheduleId}?`)) return;
    await deleteSchedule(scheduleId);
    load();
  };

  const handleToggle = async (s: ScheduledTask) => {
    setLoading(s.id);
    try {
      if (s.status === "paused") {
        await resumeSchedule(s.id);
      } else {
        await pauseSchedule(s.id);
      }
      load();
    } finally {
      setLoading(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Schedules</h2>
        <Link
          href={`/projects/${id}/schedules/new`}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium"
        >
          + New Schedule
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left p-3">ID</th>
              <th className="text-left p-3">Task</th>
              <th className="text-left p-3">Persona</th>
              <th className="text-left p-3">Trigger</th>
              <th className="text-left p-3">Next Run</th>
              <th className="text-left p-3">Last Run</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr
                key={s.id}
                className="border-b border-gray-800/50 hover:bg-gray-800/30"
              >
                <td className="p-3 font-mono text-cyan-400">{s.id}</td>
                <td className="p-3">{s.task_name}</td>
                <td className="p-3">{s.persona_name || "-"}</td>
                <td className="p-3 text-xs">{formatTrigger(s)}</td>
                <td className="p-3 text-xs">
                  {s.next_run_at
                    ? new Date(s.next_run_at).toLocaleString()
                    : "-"}
                </td>
                <td className="p-3 text-xs">
                  {s.last_run_at
                    ? new Date(s.last_run_at).toLocaleString()
                    : "-"}
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[s.status] || ""}`}
                  >
                    {s.status}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <Link
                      href={`/projects/${id}/schedules/${s.id}`}
                      className="text-blue-400 hover:text-blue-300 text-xs"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleToggle(s)}
                      disabled={loading === s.id}
                      className="text-yellow-400 hover:text-yellow-300 text-xs disabled:opacity-50"
                    >
                      {loading === s.id
                        ? "..."
                        : s.status === "paused"
                          ? "Resume"
                          : "Pause"}
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {schedules.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-500">
                  No schedules yet. Create one to automate task execution.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
