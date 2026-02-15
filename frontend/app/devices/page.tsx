"use client";

import { useEffect, useState } from "react";
import { getDevices, refreshDevices } from "@/lib/api";
import type { Device } from "@/lib/types";

const statusColors: Record<string, string> = {
  available: "bg-green-500/20 text-green-400",
  busy: "bg-yellow-500/20 text-yellow-400",
  error: "bg-red-500/20 text-red-400",
  offline: "bg-gray-500/20 text-gray-400",
};

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    getDevices().then(setDevices).catch(console.error);
  };

  useEffect(load, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const devs = await refreshDevices();
      setDevices(devs);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Devices</h2>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium disabled:opacity-50"
        >
          {refreshing ? "Scanning..." : "Refresh ADB"}
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left p-3">Serial</th>
              <th className="text-left p-3">Model</th>
              <th className="text-left p-3">Brand</th>
              <th className="text-left p-3">Android</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Current Task</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.serial} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="p-3 font-mono text-cyan-400">{d.serial}</td>
                <td className="p-3">{d.model || "-"}</td>
                <td className="p-3">{d.brand || "-"}</td>
                <td className="p-3">{d.android_version || "-"}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[d.status] || ""}`}>
                    {d.status}
                  </span>
                </td>
                <td className="p-3 font-mono text-xs">{d.current_task || "-"}</td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-gray-500">
                  No devices found. Click &quot;Refresh ADB&quot; to scan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
