"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getDevices,
  getHarvestJobs,
  getHarvestedProfiles,
  startHarvestJob,
  discardProfile,
  markProfileUsed,
} from "@/lib/api";
import type { Device, HarvestJob, HarvestedProfile } from "@/lib/types";

const inputClass =
  "w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none";
const selectClass = inputClass;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    queued: "bg-gray-500/20 text-gray-400",
    running: "bg-yellow-500/20 text-yellow-400",
    completed: "bg-green-500/20 text-green-400",
    failed: "bg-red-500/20 text-red-400",
    raw: "bg-blue-500/20 text-blue-400",
    validated: "bg-purple-500/20 text-purple-400",
    used: "bg-green-500/20 text-green-400",
    discarded: "bg-gray-500/20 text-gray-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-gray-500/20 text-gray-400"}`}>
      {status}
    </span>
  );
}

function formatDuration(started: string | null, completed: string | null): string {
  if (!started) return "-";
  const start = new Date(started).getTime();
  const end = completed ? new Date(completed).getTime() : Date.now();
  const secs = Math.round((end - start) / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

export default function HarvestPage() {
  // -- Form state --
  const [platform, setPlatform] = useState("instagram");
  const [igHandle, setIgHandle] = useState("");
  const [tiktokHandle, setTiktokHandle] = useState("");
  const [harvestType, setHarvestType] = useState("follower");
  const [targetCount, setTargetCount] = useState(50);
  const [priority, setPriority] = useState(0);
  const [geoArea, setGeoArea] = useState("");
  const [deviceSerial, setDeviceSerial] = useState("");
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState("");

  // -- Data state --
  const [devices, setDevices] = useState<Device[]>([]);
  const [jobs, setJobs] = useState<HarvestJob[]>([]);
  const [profiles, setProfiles] = useState<HarvestedProfile[]>([]);
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);

  // -- Profile filters --
  const [filterArtist, setFilterArtist] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSourceType, setFilterSourceType] = useState("");

  // -- Load devices once --
  useEffect(() => {
    getDevices().then((d) => {
      setDevices(d);
      if (d.length === 1) setDeviceSerial(d[0].serial);
    }).catch(console.error);
  }, []);

  // -- Load jobs --
  const loadJobs = useCallback(() => {
    getHarvestJobs().then((d) => setJobs(d.results || [])).catch(console.error);
  }, []);

  useEffect(loadJobs, [loadJobs]);

  // -- Auto-refresh while any job is running/queued --
  useEffect(() => {
    const hasActive = jobs.some((j) => j.status === "running" || j.status === "queued");
    if (!hasActive) return;
    const interval = setInterval(loadJobs, 5000);
    return () => clearInterval(interval);
  }, [jobs, loadJobs]);

  // -- Load profiles --
  const loadProfiles = useCallback(() => {
    const params: Record<string, string> = {};
    if (filterArtist) params.artist = filterArtist;
    if (filterStatus) params.status = filterStatus;
    if (filterSourceType) params.source_type = filterSourceType;
    getHarvestedProfiles(params).then((d) => setProfiles(d.results || [])).catch(console.error);
  }, [filterArtist, filterStatus, filterSourceType]);

  useEffect(loadProfiles, [loadProfiles]);

  // -- Derived --
  const activeHandle = platform === "instagram" ? igHandle : tiktokHandle;
  const canStart = activeHandle.trim().length > 0;

  // -- Start harvest --
  const handleStart = async () => {
    const handle = activeHandle.trim().replace(/^@/, "");
    if (!handle) {
      setMessage(`${platform === "instagram" ? "Instagram" : "TikTok"} handle is required`);
      return;
    }
    setStarting(true);
    setMessage("");
    try {
      const job = await startHarvestJob({
        platform,
        artist_name: handle,
        harvest_type: harvestType,
        target_count: targetCount,
        priority: priority || undefined,
        geographic_area: geoArea || undefined,
        device_serial: deviceSerial || undefined,
      });
      setMessage(`Harvest job ${job.id} started for @${handle} on ${platform}`);
      loadJobs();
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setStarting(false);
    }
  };

  // -- Profile actions --
  const handleDiscard = async (id: string) => {
    await discardProfile(id);
    loadProfiles();
  };

  const handleMarkUsed = async (id: string) => {
    await markProfileUsed(id);
    loadProfiles();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Harvest</h1>

      {/* Start Harvest Form */}
      <Section title="Start Harvest">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Platform">
            <select className={selectClass} value={platform} onChange={(e) => setPlatform(e.target.value)}>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
            </select>
          </Field>

          <Field label="Instagram Handle">
            <div className="relative">
              <span className="absolute left-3 top-1.5 text-sm text-gray-500">@</span>
              <input
                className={inputClass + " pl-7"}
                placeholder="feliciathegoat"
                value={igHandle}
                onChange={(e) => setIgHandle(e.target.value)}
              />
            </div>
          </Field>

          <Field label="TikTok Handle">
            <div className="relative">
              <span className="absolute left-3 top-1.5 text-sm text-gray-500">@</span>
              <input
                className={inputClass + " pl-7"}
                placeholder="tylerthecreator"
                value={tiktokHandle}
                onChange={(e) => setTiktokHandle(e.target.value)}
              />
            </div>
          </Field>

          <Field label="Harvest Type">
            <select className={selectClass} value={harvestType} onChange={(e) => setHarvestType(e.target.value)}>
              <option value="follower">Followers</option>
              <option value="commenter">Commenters</option>
            </select>
          </Field>

          <Field label="Target Count">
            <input
              type="number"
              className={inputClass}
              value={targetCount}
              min={1}
              max={500}
              onChange={(e) => setTargetCount(Number(e.target.value))}
            />
          </Field>

          <Field label="Priority">
            <select className={selectClass} value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
              <option value={0}>Normal</option>
              <option value={1}>High</option>
              <option value={2}>Urgent</option>
            </select>
          </Field>

          <Field label="Geographic Area">
            <input
              className={inputClass}
              placeholder="e.g. Los Angeles, USA"
              value={geoArea}
              onChange={(e) => setGeoArea(e.target.value)}
            />
          </Field>

          <Field label="Device">
            <select className={selectClass} value={deviceSerial} onChange={(e) => setDeviceSerial(e.target.value)}>
              <option value="">Auto (any available)</option>
              {devices
                .filter((d) => d.status === "available")
                .map((d) => (
                  <option key={d.serial} value={d.serial}>
                    {d.model || d.serial} ({d.serial.slice(-6)})
                  </option>
                ))}
            </select>
          </Field>

          <div className="flex items-end">
            <button
              onClick={handleStart}
              disabled={starting || !canStart}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 px-6 py-1.5 rounded text-sm font-medium transition-colors"
            >
              {starting ? "Starting..." : "Start Harvest"}
            </button>
          </div>
        </div>

        {message && (
          <p className={`mt-3 text-sm ${message.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
            {message}
          </p>
        )}
      </Section>

      {/* Jobs Table */}
      <Section title="Harvest Jobs">
        {jobs.length === 0 ? (
          <p className="text-sm text-gray-500">No harvest jobs yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-800">
                  <th className="pb-2 pr-4">ID</th>
                  <th className="pb-2 pr-4">Artist</th>
                  <th className="pb-2 pr-4">Type</th>
                  <th className="pb-2 pr-4">Priority</th>
                  <th className="pb-2 pr-4">Area</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Profiles</th>
                  <th className="pb-2 pr-4">Device</th>
                  <th className="pb-2 pr-4">Duration</th>
                  <th className="pb-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 pr-4 font-mono text-xs text-gray-500">{job.id}</td>
                    <td className="py-2 pr-4">@{job.artist_name}</td>
                    <td className="py-2 pr-4">{job.harvest_type}</td>
                    <td className="py-2 pr-4">
                      {job.priority === 2 ? (
                        <span className="text-red-400 text-xs font-medium">Urgent</span>
                      ) : job.priority === 1 ? (
                        <span className="text-yellow-400 text-xs font-medium">High</span>
                      ) : (
                        <span className="text-gray-500 text-xs">Normal</span>
                      )}
                    </td>
                    <td className="py-2 pr-4 text-gray-400 text-xs">{job.geographic_area || "-"}</td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="py-2 pr-4">{job.profiles_harvested}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-gray-500">
                      {job.device_serial ? job.device_serial.slice(-6) : "-"}
                    </td>
                    <td className="py-2 pr-4 text-gray-400">
                      {formatDuration(job.started_at, job.completed_at)}
                    </td>
                    <td className="py-2 text-red-400 text-xs max-w-xs truncate">
                      {job.error || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Harvested Profiles */}
      <Section title="Harvested Profiles">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <input
            className={inputClass}
            placeholder="Filter by artist..."
            value={filterArtist}
            onChange={(e) => setFilterArtist(e.target.value)}
          />
          <select className={selectClass} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="raw">Raw</option>
            <option value="validated">Validated</option>
            <option value="used">Used</option>
            <option value="discarded">Discarded</option>
          </select>
          <select className={selectClass} value={filterSourceType} onChange={(e) => setFilterSourceType(e.target.value)}>
            <option value="">All types</option>
            <option value="follower">Followers</option>
            <option value="commenter">Commenters</option>
          </select>
          <button
            onClick={loadProfiles}
            className="bg-gray-800 hover:bg-gray-700 px-4 py-1.5 rounded text-sm transition-colors"
          >
            Refresh
          </button>
        </div>

        {profiles.length === 0 ? (
          <p className="text-sm text-gray-500">No profiles found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left border-b border-gray-800">
                  <th className="pb-2 pr-4">Username</th>
                  <th className="pb-2 pr-4">Platform</th>
                  <th className="pb-2 pr-4">Source</th>
                  <th className="pb-2 pr-4">Artist</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Confidence</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <>
                    <tr
                      key={p.id}
                      className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer"
                      onClick={() => setExpandedProfile(expandedProfile === p.id ? null : p.id)}
                    >
                      <td className="py-2 pr-4 font-medium">
                        {p.profile_data.username || p.profile_data.display_name || "unknown"}
                      </td>
                      <td className="py-2 pr-4">{p.platform}</td>
                      <td className="py-2 pr-4">{p.source_type}</td>
                      <td className="py-2 pr-4">@{p.source_artist}</td>
                      <td className="py-2 pr-4">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="py-2 pr-4 text-gray-400">
                        {(p.confidence_score * 100).toFixed(0)}%
                      </td>
                      <td className="py-2">
                        {p.status === "raw" && (
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleMarkUsed(p.id); }}
                              className="text-xs text-green-400 hover:text-green-300"
                            >
                              Use
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDiscard(p.id); }}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Discard
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {expandedProfile === p.id && (
                      <tr key={`${p.id}-detail`} className="border-b border-gray-800/50">
                        <td colSpan={7} className="py-3 px-4">
                          <pre className="text-xs text-gray-400 bg-gray-800 rounded p-3 overflow-x-auto">
                            {JSON.stringify(p.profile_data, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
