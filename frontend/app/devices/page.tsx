"use client";

import { useEffect, useState } from "react";
import { getDevices, refreshDevices, updateDeviceMetadata } from "@/lib/api";
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
  const [editSerial, setEditSerial] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", bay: "", slot: "", location_label: "", device_ip: "" });

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

  const startEdit = (d: Device) => {
    setEditSerial(d.serial);
    setEditForm({
      name: d.name || "",
      bay: d.bay || "",
      slot: d.slot || "",
      location_label: d.location_label || "",
      device_ip: d.device_ip || "",
    });
  };

  const saveEdit = async () => {
    if (!editSerial) return;
    try {
      await updateDeviceMetadata(editSerial, {
        ...editForm,
        device_ip: editForm.device_ip || null,
      });
      setEditSerial(null);
      load();
    } catch (e) {
      console.error("Failed to update device metadata:", e);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">Devices</h2>
          <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400">
            {devices.length} devices
          </span>
        </div>
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
            <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
              <th className="text-left p-3">Serial</th>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Model</th>
              <th className="text-left p-3">Location</th>
              <th className="text-left p-3">IP</th>
              <th className="text-left p-3">Android</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Current Task</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d) => (
              <tr key={d.serial} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="p-3 font-mono text-cyan-400">{d.serial}</td>
                <td className="p-3">
                  {editSerial === d.serial ? (
                    <input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-sm w-24"
                      placeholder="name"
                    />
                  ) : (
                    d.name || <span className="text-gray-600">-</span>
                  )}
                </td>
                <td className="p-3">{d.model || "-"}</td>
                <td className="p-3">
                  {editSerial === d.serial ? (
                    <div className="flex gap-1">
                      <input
                        value={editForm.bay}
                        onChange={(e) => setEditForm({ ...editForm, bay: e.target.value })}
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-sm w-12"
                        placeholder="bay"
                      />
                      <input
                        value={editForm.slot}
                        onChange={(e) => setEditForm({ ...editForm, slot: e.target.value })}
                        className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-sm w-12"
                        placeholder="slot"
                      />
                    </div>
                  ) : (
                    [d.bay, d.slot, d.location_label].filter(Boolean).join(" / ") || <span className="text-gray-600">-</span>
                  )}
                </td>
                <td className="p-3 font-mono text-xs">
                  {editSerial === d.serial ? (
                    <input
                      value={editForm.device_ip}
                      onChange={(e) => setEditForm({ ...editForm, device_ip: e.target.value })}
                      className="bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-sm w-28"
                      placeholder="IP address"
                    />
                  ) : (
                    d.device_ip || <span className="text-gray-600">-</span>
                  )}
                </td>
                <td className="p-3">{d.android_version || "-"}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[d.status] || ""}`}>
                    {d.status}
                  </span>
                </td>
                <td className="p-3 font-mono text-xs">{d.current_task || "-"}</td>
                <td className="p-3 text-right">
                  {editSerial === d.serial ? (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={saveEdit}
                        className="px-2 py-1 bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded text-xs"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditSerial(null)}
                        className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    d.db_id != null && (
                      <button
                        onClick={() => startEdit(d)}
                        className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded text-xs"
                      >
                        Edit
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-gray-500">
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
