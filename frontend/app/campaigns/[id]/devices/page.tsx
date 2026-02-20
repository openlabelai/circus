"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getDevices, refreshDevices } from "@/lib/api";
import type { Device } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-500",
  busy: "bg-yellow-500",
  error: "bg-red-500",
  offline: "bg-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  available: "Available",
  busy: "Busy",
  error: "Error",
  offline: "Offline",
};

export default function DevicesPage() {
  const { id } = useParams<{ id: string }>();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await getDevices();
      setDevices(data);
    } catch (e) {
      console.error("Failed to load devices:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await refreshDevices();
      setDevices(data);
    } catch (e) {
      console.error("Failed to refresh devices:", e);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading devices...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Devices</h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md text-sm transition-colors disabled:opacity-50"
        >
          {refreshing ? "Scanning..." : "Refresh"}
        </button>
      </div>

      {devices.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No devices connected</p>
          <p className="text-sm">Connect Android devices via USB and click Refresh</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {devices.map((device) => (
            <DeviceCard key={device.serial} device={device} />
          ))}
        </div>
      )}
    </div>
  );
}

function DeviceCard({ device }: { device: Device }) {
  const [streamError, setStreamError] = useState(false);
  const streamUrl = `${API_URL}/devices/${device.serial}/screen/stream/`;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
      {/* Screen preview */}
      <div className="aspect-[9/16] bg-black flex items-center justify-center relative">
        {device.status !== "offline" && !streamError ? (
          <img
            src={streamUrl}
            alt={`${device.serial} screen`}
            className="w-full h-full object-contain"
            onError={() => setStreamError(true)}
          />
        ) : (
          <div className="text-gray-600 text-sm text-center px-4">
            {device.status === "offline" ? "Device offline" : "No stream available"}
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-2 right-2">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${STATUS_COLORS[device.status] || "bg-gray-500"}`}
            title={STATUS_LABELS[device.status] || device.status}
          />
        </div>
      </div>

      {/* Device info */}
      <div className="p-3">
        <div className="text-sm font-medium truncate" title={device.serial}>
          {device.model || device.serial}
        </div>
        <div className="text-xs text-gray-500 truncate mt-0.5">
          {device.serial}
        </div>
        <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400">
          {device.brand && <span>{device.brand}</span>}
          {device.android_version && <span>Android {device.android_version}</span>}
        </div>
        {device.current_task && (
          <div className="mt-1.5 text-xs text-yellow-400 truncate" title={device.current_task}>
            Running: {device.current_task}
          </div>
        )}
      </div>
    </div>
  );
}
