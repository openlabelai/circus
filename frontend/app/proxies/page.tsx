"use client";

import { useEffect, useState } from "react";
import { getProxies, createProxy, updateProxy, deleteProxy } from "@/lib/api";
import type { Proxy } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/20 text-green-400",
  inactive: "bg-gray-500/20 text-gray-400",
  banned: "bg-red-500/20 text-red-400",
  testing: "bg-yellow-500/20 text-yellow-400",
};

const PROTOCOL_OPTIONS = ["http", "https", "socks5"];

const emptyForm = {
  host: "",
  port: "",
  protocol: "http",
  username: "",
  password: "",
  provider: "",
  country: "",
  city: "",
  notes: "",
};

export default function ProxiesPage() {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await getProxies();
      setProxies(data.results || []);
    } catch (e) {
      console.error("Failed to load proxies:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.host || !form.port) return;
    setSaving(true);
    try {
      await createProxy({ ...form, port: parseInt(form.port) } as any);
      setForm(emptyForm);
      setShowAdd(false);
      await load();
    } catch (e) {
      console.error("Failed to create proxy:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (proxy: Proxy, newStatus: string) => {
    try {
      await updateProxy(proxy.id, { status: newStatus } as Partial<Proxy>);
      await load();
    } catch (e) {
      console.error("Failed to update proxy:", e);
    }
  };

  const handleDelete = async (proxy: Proxy) => {
    if (!confirm(`Delete proxy ${proxy.host}:${proxy.port}?`)) return;
    try {
      await deleteProxy(proxy.id);
      await load();
    } catch (e) {
      console.error("Failed to delete proxy:", e);
    }
  };

  if (loading) {
    return <div className="text-gray-400 p-8">Loading proxies...</div>;
  }

  const statusCounts = proxies.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Proxy Pool</h1>
          <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400">
            {proxies.length} proxies
          </span>
          {statusCounts.active && (
            <span className="px-2 py-0.5 bg-green-900/30 rounded text-xs text-green-400">
              {statusCounts.active} active
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md text-sm font-medium"
        >
          {showAdd ? "Cancel" : "+ Add Proxy"}
        </button>
      </div>

      {showAdd && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Protocol</label>
              <select
                value={form.protocol}
                onChange={(e) => setForm({ ...form, protocol: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
              >
                {PROTOCOL_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Host</label>
              <input
                value={form.host}
                onChange={(e) => setForm({ ...form, host: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
                placeholder="proxy.example.com"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Port</label>
              <input
                type="number"
                value={form.port}
                onChange={(e) => setForm({ ...form, port: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
                placeholder="8080"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Provider</label>
              <input
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
                placeholder="e.g. Bright Data"
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3 mt-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Username</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
                placeholder="optional"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
                placeholder="optional"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Country</label>
              <input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
                placeholder="US"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">City</label>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
                placeholder="optional"
              />
            </div>
          </div>
          <div className="mt-3">
            <button
              onClick={handleAdd}
              disabled={saving || !form.host || !form.port}
              className="px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add Proxy"}
            </button>
          </div>
        </div>
      )}

      {proxies.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No proxies configured</p>
          <p className="text-sm">Add proxies to route device traffic through different IPs and locations</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                <th className="text-left px-4 py-3">Endpoint</th>
                <th className="text-left px-4 py-3">Protocol</th>
                <th className="text-left px-4 py-3">Provider</th>
                <th className="text-left px-4 py-3">Location</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Latency</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {proxies.map((proxy) => (
                <tr key={proxy.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3 font-mono text-cyan-400">
                    {proxy.host}:{proxy.port}
                  </td>
                  <td className="px-4 py-3 uppercase">{proxy.protocol}</td>
                  <td className="px-4 py-3">{proxy.provider || "\u2014"}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {[proxy.city, proxy.country].filter(Boolean).join(", ") || "\u2014"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[proxy.status] || ""}`}>
                      {proxy.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {proxy.latency_ms != null ? `${proxy.latency_ms}ms` : "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {proxy.status !== "active" && (
                        <button
                          onClick={() => handleStatusChange(proxy, "active")}
                          className="px-2 py-1 bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded text-xs"
                        >
                          Active
                        </button>
                      )}
                      {proxy.status !== "inactive" && (
                        <button
                          onClick={() => handleStatusChange(proxy, "inactive")}
                          className="px-2 py-1 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded text-xs"
                        >
                          Inactive
                        </button>
                      )}
                      {proxy.status !== "banned" && (
                        <button
                          onClick={() => handleStatusChange(proxy, "banned")}
                          className="px-2 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded text-xs"
                        >
                          Banned
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(proxy)}
                        className="px-2 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded text-xs"
                      >
                        &#10005;
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
