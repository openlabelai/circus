"use client";

import { useEffect, useState, useCallback } from "react";
import {
  getQueue,
  cancelQueuedRun,
  enqueueTask,
  getTasks,
  getPersonas,
  getDevices,
} from "@/lib/api";
import type { QueuedRun, Task, PersonaSummary, Device } from "@/lib/types";

const statusColors: Record<string, string> = {
  queued: "bg-gray-500/20 text-gray-400",
  running: "bg-yellow-500/20 text-yellow-400",
  completed: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
  skipped: "bg-gray-500/20 text-gray-500",
  cancelled: "bg-orange-500/20 text-orange-400",
};

const STATUS_FILTERS = ["", "queued", "running", "completed", "failed", "cancelled"];

export default function QueuePage() {
  const [runs, setRuns] = useState<QueuedRun[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [showEnqueue, setShowEnqueue] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  // Enqueue form
  const [tasks, setTasks] = useState<Task[]>([]);
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [enqueueForm, setEnqueueForm] = useState({
    task_id: "",
    persona_id: "",
    device_serial: "",
  });
  const [enqueueing, setEnqueueing] = useState(false);

  const load = useCallback(() => {
    const params = statusFilter ? { status: statusFilter } : undefined;
    getQueue(params)
      .then((d) => setRuns(d.results || []))
      .catch(console.error);
  }, [statusFilter]);

  useEffect(load, [load]);

  // Auto-refresh every 5s
  useEffect(() => {
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  // Load dropdown data when enqueue form opens
  useEffect(() => {
    if (showEnqueue) {
      getTasks()
        .then((d) => setTasks(d.results || []))
        .catch(console.error);
      getPersonas()
        .then((d) => setPersonas(d.results || []))
        .catch(console.error);
      getDevices().then(setDevices).catch(console.error);
    }
  }, [showEnqueue]);

  const handleCancel = async (id: string) => {
    setCancelling(id);
    try {
      await cancelQueuedRun(id);
      load();
    } finally {
      setCancelling(null);
    }
  };

  const handleEnqueue = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnqueueing(true);
    try {
      await enqueueTask({
        task_id: enqueueForm.task_id,
        ...(enqueueForm.persona_id && { persona_id: enqueueForm.persona_id }),
        ...(enqueueForm.device_serial && {
          device_serial: enqueueForm.device_serial,
        }),
      });
      setShowEnqueue(false);
      setEnqueueForm({ task_id: "", persona_id: "", device_serial: "" });
      load();
    } finally {
      setEnqueueing(false);
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "-";
    return new Date(iso).toLocaleTimeString();
  };

  const formatDuration = (run: QueuedRun) => {
    if (!run.started_at) return "-";
    const start = new Date(run.started_at).getTime();
    const end = run.completed_at
      ? new Date(run.completed_at).getTime()
      : Date.now();
    const seconds = Math.round((end - start) / 1000);
    return `${seconds}s`;
  };

  const inputClass =
    "w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Queue</h2>
        <button
          onClick={() => setShowEnqueue(!showEnqueue)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium"
        >
          {showEnqueue ? "Cancel" : "+ Enqueue Task"}
        </button>
      </div>

      {/* Enqueue form */}
      {showEnqueue && (
        <form
          onSubmit={handleEnqueue}
          className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6"
        >
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Task *
              </label>
              <select
                className={inputClass}
                value={enqueueForm.task_id}
                onChange={(e) =>
                  setEnqueueForm({ ...enqueueForm, task_id: e.target.value })
                }
                required
              >
                <option value="">Select task...</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Persona (optional)
              </label>
              <select
                className={inputClass}
                value={enqueueForm.persona_id}
                onChange={(e) =>
                  setEnqueueForm({
                    ...enqueueForm,
                    persona_id: e.target.value,
                  })
                }
              >
                <option value="">None</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Device (optional)
              </label>
              <select
                className={inputClass}
                value={enqueueForm.device_serial}
                onChange={(e) =>
                  setEnqueueForm({
                    ...enqueueForm,
                    device_serial: e.target.value,
                  })
                }
              >
                <option value="">Any available</option>
                {devices.map((d) => (
                  <option key={d.serial} value={d.serial}>
                    {d.model} ({d.serial})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={enqueueing}
            className="px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium disabled:opacity-50"
          >
            {enqueueing ? "Enqueueing..." : "Enqueue Now"}
          </button>
        </form>
      )}

      {/* Status filters */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-400">Filter:</span>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded text-xs ${
              statusFilter === s
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left p-3">ID</th>
              <th className="text-left p-3">Task</th>
              <th className="text-left p-3">Device</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Attempt</th>
              <th className="text-left p-3">Queued</th>
              <th className="text-left p-3">Duration</th>
              <th className="text-left p-3">Error</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr
                key={r.id}
                className="border-b border-gray-800/50 hover:bg-gray-800/30"
              >
                <td className="p-3 font-mono text-cyan-400">{r.id}</td>
                <td className="p-3">{r.task_name}</td>
                <td className="p-3 font-mono text-xs">
                  {r.device_serial || "-"}
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[r.status] || ""}`}
                  >
                    {r.status}
                  </span>
                </td>
                <td className="p-3 text-xs">
                  {r.attempt}/{r.max_retries}
                </td>
                <td className="p-3 text-xs">{formatTime(r.queued_at)}</td>
                <td className="p-3 text-xs">{formatDuration(r)}</td>
                <td className="p-3 text-red-400 text-xs max-w-xs truncate">
                  {r.error || ""}
                </td>
                <td className="p-3">
                  {r.status === "queued" && (
                    <button
                      onClick={() => handleCancel(r.id)}
                      disabled={cancelling === r.id}
                      className="text-red-400 hover:text-red-300 text-xs disabled:opacity-50"
                    >
                      {cancelling === r.id ? "..." : "Cancel"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-gray-500">
                  No runs found. Tasks are enqueued by schedules or manually.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500 mt-3">Auto-refreshes every 5s</p>
    </div>
  );
}
