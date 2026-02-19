"use client";

import { useEffect, useState } from "react";
import { getAccounts, createAccount, updateAccount, deleteAccount } from "@/lib/api";
import type { Account } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  available: "bg-green-500/20 text-green-400",
  warming: "bg-yellow-500/20 text-yellow-400",
  assigned: "bg-blue-500/20 text-blue-400",
  banned: "bg-red-500/20 text-red-400",
  cooldown: "bg-orange-500/20 text-orange-400",
};

const PLATFORM_OPTIONS = ["instagram", "tiktok", "youtube"];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ username: "", password: "", email: "", platform: "instagram" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await getAccounts();
      setAccounts(data.results || []);
    } catch (e) {
      console.error("Failed to load accounts:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.username || !form.password) return;
    setSaving(true);
    try {
      await createAccount(form);
      setForm({ username: "", password: "", email: "", platform: "instagram" });
      setShowAdd(false);
      await load();
    } catch (e) {
      console.error("Failed to create account:", e);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (account: Account, newStatus: string) => {
    try {
      await updateAccount(account.id, { status: newStatus } as Partial<Account>);
      await load();
    } catch (e) {
      console.error("Failed to update account:", e);
    }
  };

  const handleDelete = async (account: Account) => {
    if (!confirm(`Delete account @${account.username}?`)) return;
    try {
      await deleteAccount(account.id);
      await load();
    } catch (e) {
      console.error("Failed to delete account:", e);
    }
  };

  if (loading) {
    return <div className="text-gray-400 p-8">Loading accounts...</div>;
  }

  const statusCounts = accounts.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Account Pool</h1>
          <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400">
            {accounts.length} accounts
          </span>
          {statusCounts.available && (
            <span className="px-2 py-0.5 bg-green-900/30 rounded text-xs text-green-400">
              {statusCounts.available} available
            </span>
          )}
        </div>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md text-sm font-medium"
        >
          {showAdd ? "Cancel" : "+ Add Account"}
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Platform</label>
              <select
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
              >
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Username</label>
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
                placeholder="username"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
                placeholder="password"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
                placeholder="email (optional)"
              />
            </div>
          </div>
          <div className="mt-3">
            <button
              onClick={handleAdd}
              disabled={saving || !form.username || !form.password}
              className="px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Adding..." : "Add Account"}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {accounts.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No accounts in the pool</p>
          <p className="text-sm">Add pre-warmed accounts that can be assigned to synthetic fans during campaigns</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase">
                <th className="text-left px-4 py-3">Username</th>
                <th className="text-left px-4 py-3">Platform</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Warming</th>
                <th className="text-left px-4 py-3">Created</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3 font-medium">@{account.username}</td>
                  <td className="px-4 py-3 capitalize">{account.platform}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[account.status] || ""}`}>
                      {account.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{account.email || "\u2014"}</td>
                  <td className="px-4 py-3 text-gray-400">
                    {account.warming_days_completed > 0
                      ? `${account.warming_days_completed} days`
                      : "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(account.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {account.status !== "available" && (
                        <button
                          onClick={() => handleStatusChange(account, "available")}
                          className="px-2 py-1 bg-green-900/30 hover:bg-green-900/50 text-green-400 rounded text-xs"
                        >
                          Available
                        </button>
                      )}
                      {account.status !== "banned" && (
                        <button
                          onClick={() => handleStatusChange(account, "banned")}
                          className="px-2 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded text-xs"
                        >
                          Banned
                        </button>
                      )}
                      {account.status !== "cooldown" && (
                        <button
                          onClick={() => handleStatusChange(account, "cooldown")}
                          className="px-2 py-1 bg-orange-900/30 hover:bg-orange-900/50 text-orange-400 rounded text-xs"
                        >
                          Cooldown
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(account)}
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
