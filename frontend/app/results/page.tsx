"use client";

import { useEffect, useState } from "react";
import { getResults, syncResults } from "@/lib/api";
import type { TaskResultRecord } from "@/lib/types";

export default function ResultsPage() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [results, setResults] = useState<TaskResultRecord[]>([]);
  const [syncing, setSyncing] = useState(false);

  const load = () => {
    getResults(date).then((d) => setResults(d.results || [])).catch(console.error);
  };

  useEffect(load, [date]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncResults();
      load();
    } finally {
      setSyncing(false);
    }
  };

  const successCount = results.filter((r) => r.success).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Results</h2>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
          />
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm disabled:opacity-50"
          >
            {syncing ? "Syncing..." : "Import JSONL"}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="text-sm text-gray-400 mb-4">
          {results.length} result(s) &middot; {successCount} succeeded &middot; {results.length - successCount} failed
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left p-3">Time</th>
              <th className="text-left p-3">Task</th>
              <th className="text-left p-3">Device</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Actions</th>
              <th className="text-left p-3">Duration</th>
              <th className="text-left p-3">Error</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const time = r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : "-";
              return (
                <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="p-3 text-gray-400">{time}</td>
                  <td className="p-3 font-mono text-cyan-400">{r.task_name || r.task_id}</td>
                  <td className="p-3 font-mono text-xs">{r.device_serial}</td>
                  <td className="p-3">
                    <span className={r.success ? "text-green-400" : "text-red-400"}>
                      {r.success ? "OK" : "FAIL"}
                    </span>
                  </td>
                  <td className="p-3">{r.actions_completed}/{r.actions_total}</td>
                  <td className="p-3">{r.duration}s</td>
                  <td className="p-3 text-red-400 text-xs max-w-xs truncate">{r.error || ""}</td>
                </tr>
              );
            })}
            {results.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No results for {date}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
