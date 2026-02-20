"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getArtistProfiles } from "@/lib/api";
import type { ArtistProfile, Campaign } from "@/lib/types";

const STATUS_OPTIONS = [
  { value: "planning", label: "Planning" },
  { value: "warming", label: "Warming" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
];

const PLATFORM_OPTIONS = ["", "instagram", "tiktok", "spotify", "youtube", "twitter", "threads"];

const GENRE_OPTIONS = [
  "", "afrobeats", "classical", "country", "cumbia", "edm", "folk", "hip-hop",
  "indie-rock", "jazz", "k-pop", "latin", "latin-pop", "metal", "pop", "punk",
  "r&b", "reggaeton",
];

const LABEL_OVERRIDES: Record<string, string> = { "edm": "EDM", "r&b": "R&B", "k-pop": "K-Pop" };
const capitalize = (s: string) =>
  LABEL_OVERRIDES[s] || s.replace(/(^|[-& ])(\w)/g, (_, sep, c) => sep + c.toUpperCase());

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-gray-500/20 text-gray-400",
  warming: "bg-yellow-500/20 text-yellow-400",
  active: "bg-green-500/20 text-green-400",
  paused: "bg-orange-500/20 text-orange-400",
  completed: "bg-blue-500/20 text-blue-400",
};

interface Props {
  initial?: Partial<Campaign>;
  onSave: (data: Partial<Campaign>) => Promise<void>;
  isNew?: boolean;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-4">
      <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">{title}</h3>
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

const inputClass = "w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none";
const selectClass = inputClass;

export default function CampaignForm({ initial = {}, onSave, isNew }: Props) {
  const [form, setForm] = useState<Partial<Campaign>>({
    name: "",
    description: "",
    color: "#6366f1",
    status: "planning",
    start_date: null,
    end_date: null,
    target_platform: "",
    target_artist: "",
    genre: "",
    country: "",
    artist_profile: null,
    target_persona_count: 0,
    max_devices: 0,
    notes: "",
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [artistProfiles, setArtistProfiles] = useState<ArtistProfile[]>([]);

  useEffect(() => {
    getArtistProfiles()
      .then((d) => setArtistProfiles((d.results || []).filter((p) => p.status === "completed")))
      .catch(console.error);
  }, []);

  const set = (key: string, value: any) => setForm({ ...form, [key]: value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await onSave(form);
      setMessage("Saved");
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Overview */}
      <Section title="Overview">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Name">
            <input className={inputClass} value={form.name || ""} onChange={(e) => set("name", e.target.value)} required />
          </Field>
          <Field label="Status">
            <select className={selectClass} value={form.status || "planning"} onChange={(e) => set("status", e.target.value)}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Color">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color || "#6366f1"}
                onChange={(e) => set("color", e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-gray-700 bg-transparent"
              />
              <input
                className={inputClass}
                value={form.color || "#6366f1"}
                onChange={(e) => set("color", e.target.value)}
                maxLength={7}
              />
            </div>
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Description">
            <textarea
              className={inputClass + " h-20 resize-none"}
              value={form.description || ""}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
        </div>
      </Section>

      {/* Campaign Target */}
      <Section title="Campaign Target">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <Field label="Artist Profile">
            <div className="flex items-center gap-2">
              <select
                className={selectClass}
                value={form.artist_profile || ""}
                onChange={(e) => {
                  const profileId = e.target.value || null;
                  set("artist_profile", profileId);
                  if (profileId) {
                    const profile = artistProfiles.find((p) => p.id === profileId);
                    if (profile) {
                      // Infer primary platform from available social handles
                      let platform = "";
                      if (profile.instagram_handle) platform = "instagram";
                      else if (profile.tiktok_handle) platform = "tiktok";
                      else if (profile.youtube_url) platform = "youtube";
                      else if (profile.twitter_handle) platform = "twitter";

                      setForm((prev) => ({
                        ...prev,
                        artist_profile: profileId,
                        target_artist: profile.artist_name || prev.target_artist,
                        genre: profile.genre || prev.genre,
                        country: profile.country || prev.country,
                        target_platform: platform || prev.target_platform,
                      }));
                    }
                  }
                }}
              >
                <option value="">None</option>
                {artistProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.artist_name}{p.genre ? ` (${capitalize(p.genre)})` : ""}
                  </option>
                ))}
              </select>
              <Link
                href="/artist-profiles"
                className="text-xs text-blue-400 hover:text-blue-300 whitespace-nowrap"
              >
                Manage
              </Link>
            </div>
          </Field>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <Field label="Platform">
            <select className={selectClass} value={form.target_platform || ""} onChange={(e) => set("target_platform", e.target.value)}>
              {PLATFORM_OPTIONS.map((p) => (
                <option key={p} value={p}>{p ? capitalize(p) : "Select platform..."}</option>
              ))}
            </select>
          </Field>
          <Field label="Target Artist">
            <input className={inputClass} value={form.target_artist || ""} onChange={(e) => set("target_artist", e.target.value)} placeholder="e.g. SZA, Bad Bunny" />
          </Field>
          <Field label="Genre">
            <select className={selectClass} value={form.genre || ""} onChange={(e) => set("genre", e.target.value)}>
              {GENRE_OPTIONS.map((g) => (
                <option key={g} value={g}>{g ? capitalize(g) : "Select genre..."}</option>
              ))}
            </select>
          </Field>
          <Field label="Country">
            <input className={inputClass} value={form.country || ""} onChange={(e) => set("country", e.target.value)} placeholder="e.g. Colombia" />
          </Field>
        </div>
      </Section>

      {/* Timeline */}
      <Section title="Timeline">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Start Date">
            <input
              type="date"
              className={inputClass}
              value={form.start_date || ""}
              onChange={(e) => set("start_date", e.target.value || null)}
            />
          </Field>
          <Field label="End Date">
            <input
              type="date"
              className={inputClass}
              value={form.end_date || ""}
              onChange={(e) => set("end_date", e.target.value || null)}
            />
          </Field>
        </div>
      </Section>

      {/* Scale */}
      <Section title="Scale">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Synthetic Fans">
            <input
              type="number"
              className={inputClass}
              value={form.target_persona_count ?? 0}
              onChange={(e) => set("target_persona_count", parseInt(e.target.value) || 0)}
              min={0}
            />
          </Field>
          <Field label="Max Devices">
            <input
              type="number"
              className={inputClass}
              value={form.max_devices ?? 0}
              onChange={(e) => set("max_devices", parseInt(e.target.value) || 0)}
              min={0}
            />
          </Field>
        </div>
      </Section>

      {/* Notes */}
      <Section title="Notes">
        <Field label="Goals, scope, client instructions, etc.">
          <textarea
            className={inputClass + " h-32 resize-none"}
            value={form.notes || ""}
            onChange={(e) => set("notes", e.target.value)}
            placeholder="Free-form notes about this campaign..."
          />
        </Field>
      </Section>

      {/* Submit */}
      <div className="flex items-center gap-3 mt-4">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving..." : isNew ? "Create Campaign" : "Save Changes"}
        </button>
        {message && (
          <span className={`text-sm ${message.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
            {message}
          </span>
        )}
      </div>
    </form>
  );
}
