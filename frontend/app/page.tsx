"use client";

import { useEffect, useState } from "react";
import { getStatus, activateWarming, deactivateWarming } from "@/lib/api";
import type { StatusOverview } from "@/lib/types";

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {sub && <p className="text-sm text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const [status, setStatus] = useState<StatusOverview | null>(null);
  const [warmingLoading, setWarmingLoading] = useState(false);

  const refreshStatus = () => getStatus().then(setStatus).catch(console.error);

  useEffect(() => {
    refreshStatus();
  }, []);

  const handleWarming = async () => {
    setWarmingLoading(true);
    try {
      if (status?.warming?.active) {
        await deactivateWarming();
      } else {
        await activateWarming();
      }
      await refreshStatus();
    } catch (e) {
      console.error(e);
    } finally {
      setWarmingLoading(false);
    }
  };

  if (!status) return <p className="text-gray-400">Loading...</p>;

  const deviceSub = Object.entries(status.devices.by_status)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");

  const warmingActive = status.warming?.active ?? false;
  const warmingSchedules = status.warming?.active_schedules ?? 0;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Personas" value={status.personas} />
        <StatCard label="Devices" value={status.devices.total} sub={deviceSub || "none connected"} />
        <StatCard label="Tasks" value={status.tasks} />
        <StatCard
          label="Today's Runs"
          value={status.results_today.total}
          sub={`${status.results_today.successful} ok, ${status.results_today.failed} failed`}
        />
        <StatCard label="Active Schedules" value={status.schedules ?? 0} />
        <StatCard
          label="Queue Depth"
          value={(status.queue?.queued ?? 0) + (status.queue?.running ?? 0)}
          sub={status.queue ? `${status.queue.queued} queued, ${status.queue.running} running` : ""}
        />

        {/* Warming card */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 md:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Account Warming</p>
              <p className="text-3xl font-bold mt-1">
                {warmingActive ? "Active" : "Inactive"}
              </p>
              {warmingActive && (
                <p className="text-sm text-gray-500 mt-1">
                  {warmingSchedules} warming schedule{warmingSchedules !== 1 ? "s" : ""} running
                </p>
              )}
            </div>
            <button
              onClick={handleWarming}
              disabled={warmingLoading}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                warmingActive
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-green-600 hover:bg-green-700 text-white"
              } disabled:opacity-50`}
            >
              {warmingLoading
                ? "..."
                : warmingActive
                  ? "Deactivate"
                  : "Activate Warming"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
