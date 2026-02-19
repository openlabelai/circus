"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  getAgents,
  spawnAgents,
  activateAgent,
  deactivateAgent,
  executeAgentAction,
  deleteAgent,
} from "@/lib/api";
import type { Agent } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const STATUS_COLORS: Record<string, string> = {
  idle: "bg-green-500",
  busy: "bg-yellow-500",
  error: "bg-red-500",
  offline: "bg-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  idle: "Idle",
  busy: "Busy",
  error: "Error",
  offline: "Offline",
};

const ACTIONS = [
  { value: "like", label: "Like Post" },
  { value: "comment", label: "Comment" },
  { value: "follow", label: "Follow User" },
  { value: "save", label: "Save Post" },
  { value: "scrape_comments", label: "Scrape Comments" },
  { value: "scrape_profile", label: "Scrape Profile" },
];

export default function AgentsPage() {
  const { id } = useParams<{ id: string }>();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [spawning, setSpawning] = useState(false);
  const [activatingAll, setActivatingAll] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getAgents(id);
      setAgents(data.results || []);
    } catch (e) {
      console.error("Failed to load agents:", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  const handleSpawn = async () => {
    if (!id) return;
    setSpawning(true);
    try {
      await spawnAgents(id);
      await load();
    } catch (e) {
      console.error("Failed to spawn agents:", e);
    } finally {
      setSpawning(false);
    }
  };

  const handleActivateAll = async () => {
    setActivatingAll(true);
    try {
      for (const agent of agents) {
        if (agent.status === "offline") {
          await activateAgent(agent.id);
        }
      }
      await load();
    } catch (e) {
      console.error("Failed to activate agents:", e);
    } finally {
      setActivatingAll(false);
    }
  };

  const handleDeactivateAll = async () => {
    setActivatingAll(true);
    try {
      for (const agent of agents) {
        if (agent.status !== "offline") {
          await deactivateAgent(agent.id);
        }
      }
      await load();
    } catch (e) {
      console.error("Failed to deactivate agents:", e);
    } finally {
      setActivatingAll(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading agents...</div>
      </div>
    );
  }

  const hasActive = agents.some((a) => a.status !== "offline");
  const hasOffline = agents.some((a) => a.status === "offline");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Agents</h1>
        <div className="flex items-center gap-2">
          {agents.length > 0 && (
            <>
              {hasOffline && (
                <button
                  onClick={handleActivateAll}
                  disabled={activatingAll}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md text-sm transition-colors disabled:opacity-50"
                >
                  {activatingAll ? "Working..." : "Activate All"}
                </button>
              )}
              {hasActive && (
                <button
                  onClick={handleDeactivateAll}
                  disabled={activatingAll}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm transition-colors disabled:opacity-50"
                >
                  Deactivate All
                </button>
              )}
            </>
          )}
          <button
            onClick={handleSpawn}
            disabled={spawning}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md text-sm transition-colors disabled:opacity-50"
          >
            {spawning ? "Spawning..." : "Spawn Agents"}
          </button>
        </div>
      </div>

      {agents.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No agents yet</p>
          <p className="text-sm">
            Assign personas to devices, then click &quot;Spawn Agents&quot; to create agents
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function AgentCard({ agent, onRefresh }: { agent: Agent; onRefresh: () => void }) {
  const [streamError, setStreamError] = useState(false);
  const [actionMenu, setActionMenu] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [actionTarget, setActionTarget] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [showActionInput, setShowActionInput] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const streamUrl = `${API_URL}/devices/${agent.device_serial}/screen/stream/`;

  const handleToggle = async () => {
    try {
      if (agent.status === "offline") {
        await activateAgent(agent.id);
      } else {
        await deactivateAgent(agent.id);
      }
      onRefresh();
    } catch (e) {
      console.error("Toggle failed:", e);
    }
  };

  const handleExecute = async () => {
    if (!selectedAction || !actionTarget) return;
    setExecuting(true);
    try {
      await executeAgentAction(agent.id, {
        action: selectedAction,
        target: actionTarget,
      });
      setShowActionInput(false);
      setActionTarget("");
      setSelectedAction("");
      onRefresh();
    } catch (e) {
      console.error("Action failed:", e);
    } finally {
      setExecuting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this agent?")) return;
    setDeleting(true);
    try {
      await deleteAgent(agent.id);
      onRefresh();
    } catch (e) {
      console.error("Delete failed:", e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden flex flex-col">
      {/* Screen preview */}
      <div className="aspect-[9/16] bg-black flex items-center justify-center relative">
        {agent.status !== "offline" && !streamError ? (
          <img
            src={streamUrl}
            alt={`${agent.device_serial} screen`}
            className="w-full h-full object-contain"
            onError={() => setStreamError(true)}
          />
        ) : (
          <div className="text-gray-600 text-sm text-center px-4">
            {agent.status === "offline" ? "Agent offline" : "No stream available"}
          </div>
        )}

        {/* Status badge */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 rounded-full px-2 py-1">
          <span
            className={`inline-block w-2 h-2 rounded-full ${STATUS_COLORS[agent.status] || "bg-gray-500"}`}
          />
          <span className="text-xs text-gray-300">
            {STATUS_LABELS[agent.status] || agent.status}
          </span>
        </div>

        {/* Platform badge */}
        <div className="absolute top-2 left-2 bg-black/60 rounded-full px-2 py-1">
          <span className="text-xs text-gray-300 capitalize">{agent.platform}</span>
        </div>

        {/* Current action overlay */}
        {agent.current_action && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-3 py-2">
            <div className="text-xs text-yellow-400 flex items-center gap-1.5">
              <span className="animate-pulse">&#9679;</span>
              {agent.current_action}
            </div>
          </div>
        )}
      </div>

      {/* Agent info */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        <div>
          <div className="text-sm font-medium truncate">
            {agent.persona_name || "Unknown Persona"}
          </div>
          <div className="text-xs text-gray-500 truncate">
            @{agent.persona_username || "—"}
          </div>
        </div>

        <div className="text-xs text-gray-400 space-y-0.5">
          <div className="truncate" title={agent.device_serial}>
            {agent.device_serial}
          </div>
          <div>Port: {agent.api_port}</div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>Today: {agent.actions_today}</span>
          <span>Total: {agent.total_actions}</span>
        </div>

        {agent.error_message && (
          <div className="text-xs text-red-400 bg-red-900/20 rounded px-2 py-1 truncate" title={agent.error_message}>
            {agent.error_message}
          </div>
        )}

        {/* Action input */}
        {showActionInput && (
          <div className="space-y-2 border-t border-gray-800 pt-2">
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
            >
              <option value="">Select action...</option>
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={actionTarget}
              onChange={(e) => setActionTarget(e.target.value)}
              placeholder="Target (media ID, username)"
              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs"
            />
            <div className="flex gap-1">
              <button
                onClick={handleExecute}
                disabled={executing || !selectedAction || !actionTarget}
                className="flex-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-xs disabled:opacity-50"
              >
                {executing ? "Running..." : "Execute"}
              </button>
              <button
                onClick={() => setShowActionInput(false)}
                className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-1 mt-auto pt-2 border-t border-gray-800">
          <button
            onClick={handleToggle}
            className={`flex-1 px-2 py-1.5 rounded text-xs transition-colors ${
              agent.status === "offline"
                ? "bg-green-600 hover:bg-green-700"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            {agent.status === "offline" ? "Activate" : "Deactivate"}
          </button>
          {agent.status !== "offline" && !showActionInput && (
            <button
              onClick={() => setShowActionInput(true)}
              className="flex-1 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded text-xs"
            >
              Action
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-2 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded text-xs disabled:opacity-50"
            title="Delete agent"
          >
            &#10005;
          </button>
        </div>
      </div>
    </div>
  );
}
