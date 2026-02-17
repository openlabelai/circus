"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getTasks, syncTasks, runTask, runTaskAll, deleteTask } from "@/lib/api";
import type { Task } from "@/lib/types";

export default function TasksPage() {
  const { id } = useParams<{ id: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = () => {
    getTasks(id).then((d) => setTasks(d.results || [])).catch(console.error);
  };

  useEffect(load, [id]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncTasks();
      setMessage(`Synced ${res.imported} task(s) from disk`);
      load();
    } finally {
      setSyncing(false);
    }
  };

  const handleRun = async (taskId: string) => {
    setRunning(taskId);
    setMessage("");
    try {
      const res = await runTask(taskId);
      setMessage(res.success ? `Task completed on ${res.device_serial}` : `Failed: ${res.error}`);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setRunning(null);
    }
  };

  const handleRunAll = async (taskId: string) => {
    setRunning(taskId);
    setMessage("");
    try {
      const res = await runTaskAll(taskId);
      setMessage(`${res.successful}/${res.total_devices} succeeded in ${res.duration}s`);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setRunning(null);
    }
  };

  const handleDelete = async (taskId: string, name: string) => {
    if (!confirm(`Delete task "${name}"? This will also remove the YAML file.`)) return;
    try {
      await deleteTask(taskId);
      setMessage(`Deleted task "${name}"`);
      load();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Tasks</h2>
        <div className="flex gap-2">
          <Link
            href={`/projects/${id}/tasks/new`}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md text-sm font-medium"
          >
            + New Task
          </Link>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Sync from Disk"}
          </button>
        </div>
      </div>

      {message && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 mb-4 text-sm">
          {message}
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Description</th>
              <th className="text-left p-3">Actions</th>
              <th className="text-left p-3">Timeout</th>
              <th className="text-left p-3">Controls</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="p-3">
                  <Link href={`/projects/${id}/tasks/${t.id}`} className="text-blue-400 hover:text-blue-300">
                    {t.name}
                  </Link>
                </td>
                <td className="p-3 text-gray-400 max-w-xs truncate">{t.description || "-"}</td>
                <td className="p-3">{t.actions.length} steps</td>
                <td className="p-3">{t.timeout}s</td>
                <td className="p-3 flex gap-2">
                  <button
                    onClick={() => handleRun(t.id)}
                    disabled={running === t.id}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-xs font-medium disabled:opacity-50"
                  >
                    {running === t.id ? "Running..." : "Run"}
                  </button>
                  <button
                    onClick={() => handleRunAll(t.id)}
                    disabled={running === t.id}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs font-medium disabled:opacity-50"
                  >
                    Run All
                  </button>
                  <button
                    onClick={() => handleDelete(t.id, t.name)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-xs font-medium"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {tasks.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-gray-500">
                  No tasks found. Click &quot;Sync from Disk&quot; to import YAML files.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
