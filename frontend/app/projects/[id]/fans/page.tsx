"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  getAgents,
  getProject,
  generateFans,
  startCampaign,
  activateAgent,
  deactivateAgent,
  executeAgentAction,
  deleteAgent,
} from "@/lib/api";
import type { Agent, Project } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-500",
  ready: "bg-blue-500",
  idle: "bg-green-500",
  busy: "bg-yellow-500",
  error: "bg-red-500",
  offline: "bg-gray-500",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ready: "Ready",
  idle: "Idle",
  busy: "Busy",
  error: "Error",
  offline: "Offline",
};

const FILTER_TABS = [
  { value: "all", label: "All" },
  { value: "ready", label: "Ready" },
  { value: "active", label: "Active" },
  { value: "error", label: "Error" },
];

const ACTIONS = [
  { value: "like", label: "Like Post" },
  { value: "comment", label: "Comment" },
  { value: "follow", label: "Follow User" },
  { value: "save", label: "Save Post" },
  { value: "scrape_comments", label: "Scrape Comments" },
  { value: "scrape_profile", label: "Scrape Profile" },
];

export default function FansPage() {
  const { id } = useParams<{ id: string }>();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [generating, setGenerating] = useState(false);
  const [starting, setStarting] = useState(false);
  const [genCount, setGenCount] = useState(5);
  const [showGenInput, setShowGenInput] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [agentData, projectData] = await Promise.all([
        getAgents(id),
        getProject(id),
      ]);
      setAgents(agentData.results || []);
      setProject(projectData);
    } catch (e) {
      console.error("Failed to load:", e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  const handleGenerate = async () => {
    if (!id || genCount < 1) return;
    setGenerating(true);
    try {
      await generateFans(id, genCount);
      setShowGenInput(false);
      await load();
    } catch (e) {
      console.error("Failed to generate fans:", e);
    } finally {
      setGenerating(false);
    }
  };

  const handleStartCampaign = async () => {
    if (!id) return;
    setStarting(true);
    try {
      const result = await startCampaign(id);
      alert(`Provisioned ${result.provisioned} fans. ${result.remaining_ready} still awaiting resources.`);
      await load();
    } catch (e) {
      console.error("Failed to start campaign:", e);
    } finally {
      setStarting(false);
    }
  };

  const filtered = agents.filter((a) => {
    if (filter === "all") return true;
    if (filter === "ready") return a.status === "ready";
    if (filter === "active") return a.status === "idle" || a.status === "busy";
    if (filter === "error") return a.status === "error";
    return true;
  });

  const readyCount = agents.filter((a) => a.status === "ready").length;
  const target = project?.target_persona_count || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading fans...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Synthetic Fans</h1>
          {target > 0 && (
            <span className="px-2 py-0.5 bg-gray-800 rounded text-xs text-gray-400">
              {agents.length} of {target} fans
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {readyCount > 0 && (
            <button
              onClick={handleStartCampaign}
              disabled={starting}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md text-sm transition-colors disabled:opacity-50"
            >
              {starting ? "Starting..." : `Start Campaign (${readyCount})`}
            </button>
          )}
          {showGenInput ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={50}
                value={genCount}
                onChange={(e) => setGenCount(parseInt(e.target.value) || 1)}
                className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm"
              />
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md text-sm transition-colors disabled:opacity-50"
              >
                {generating ? "Generating..." : "Generate"}
              </button>
              <button
                onClick={() => setShowGenInput(false)}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowGenInput(true)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md text-sm transition-colors"
            >
              Generate Fans
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4">
        {FILTER_TABS.map((tab) => {
          const count =
            tab.value === "all"
              ? agents.length
              : tab.value === "ready"
              ? agents.filter((a) => a.status === "ready").length
              : tab.value === "active"
              ? agents.filter((a) => a.status === "idle" || a.status === "busy").length
              : agents.filter((a) => a.status === "error").length;
          return (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                filter === tab.value
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              {tab.label}
              {count > 0 && <span className="ml-1 text-xs text-gray-500">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Fan grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No fans yet</p>
          <p className="text-sm">
            Click &quot;Generate Fans&quot; to create synthetic fan personas for this project
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((agent) => (
            <FanCard key={agent.id} agent={agent} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  );
}

function FanCard({ agent, onRefresh }: { agent: Agent; onRefresh: () => void }) {
  const [streamError, setStreamError] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [actionTarget, setActionTarget] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [showActionInput, setShowActionInput] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const hasDevice = !!agent.device_serial;
  const isActive = agent.status === "idle" || agent.status === "busy";
  const streamUrl = hasDevice ? `${API_URL}/devices/${agent.device_serial}/screen/stream/` : "";

  const handleToggle = async () => {
    try {
      if (agent.status === "offline" || agent.status === "idle") {
        if (agent.status === "offline") {
          await activateAgent(agent.id);
        } else {
          await deactivateAgent(agent.id);
        }
      } else if (isActive) {
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
    if (!confirm("Delete this fan?")) return;
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
        {isActive && hasDevice && !streamError ? (
          <img
            src={streamUrl}
            alt={`${agent.device_serial} screen`}
            className="w-full h-full object-contain"
            onError={() => setStreamError(true)}
          />
        ) : (
          <div className="text-gray-600 text-sm text-center px-4">
            {!hasDevice
              ? "No device assigned"
              : agent.status === "ready"
              ? "Awaiting provisioning"
              : agent.status === "draft"
              ? "Draft"
              : "No stream"}
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

      {/* Fan info */}
      <div className="p-3 flex-1 flex flex-col gap-2">
        {/* Persona info */}
        <div>
          <div className="text-sm font-medium truncate">
            {agent.persona_name || "No persona"}
          </div>
          <div className="text-xs text-gray-500 truncate">
            @{agent.persona_username || "\u2014"}
          </div>
        </div>

        {/* Account info */}
        <div className="text-xs text-gray-400">
          {agent.account_username ? (
            <span className="text-indigo-400">
              Account: @{agent.account_username}
            </span>
          ) : (
            <span className="text-gray-600">No account</span>
          )}
        </div>

        {/* Device info */}
        <div className="text-xs text-gray-400">
          {agent.device_serial ? (
            <span className="truncate block" title={agent.device_serial}>
              Device: {agent.device_serial}
            </span>
          ) : (
            <span className="text-gray-600">No device</span>
          )}
        </div>

        {/* Action counters */}
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
          {(agent.status === "idle" || agent.status === "offline") && hasDevice && (
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
          )}
          {isActive && (
            <>
              <button
                onClick={handleToggle}
                className="flex-1 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs"
              >
                Deactivate
              </button>
              {!showActionInput && (
                <button
                  onClick={() => setShowActionInput(true)}
                  className="flex-1 px-2 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded text-xs"
                >
                  Action
                </button>
              )}
            </>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-2 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded text-xs disabled:opacity-50"
            title="Delete fan"
          >
            &#10005;
          </button>
        </div>
      </div>
    </div>
  );
}
