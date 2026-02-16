"use client";

import { useEffect, useState } from "react";
import { getStatus } from "@/lib/api";
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

  useEffect(() => {
    getStatus().then(setStatus).catch(console.error);
  }, []);

  if (!status) return <p className="text-gray-400">Loading...</p>;

  const deviceSub = Object.entries(status.devices.by_status)
    .map(([k, v]) => `${v} ${k}`)
    .join(", ");

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
      </div>
    </div>
  );
}
