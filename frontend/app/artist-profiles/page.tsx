"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getArtistProfiles,
  createArtistProfile,
  updateArtistProfile,
  deleteArtistProfile,
  runArtistResearch,
} from "@/lib/api";
import type { ArtistProfile } from "@/lib/types";

const GENRE_OPTIONS = [
  "", "hip-hop", "indie-rock", "edm", "r&b", "latin", "k-pop", "pop", "country",
  "jazz", "classical", "metal", "punk", "folk", "reggaeton", "afrobeats",
];

const PLATFORM_OPTIONS = ["", "instagram", "tiktok", "spotify", "youtube", "twitter", "threads"];

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-500/20 text-gray-400 border-gray-600",
  researching: "bg-yellow-500/20 text-yellow-400 border-yellow-600",
  completed: "bg-green-500/20 text-green-400 border-green-600",
  failed: "bg-red-500/20 text-red-400 border-red-600",
};

const inputClass = "w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

function TagList({ items, color = "blue" }: { items: string[]; color?: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-900/40 border-blue-700 text-blue-300",
    purple: "bg-purple-900/40 border-purple-700 text-purple-300",
    green: "bg-green-900/40 border-green-700 text-green-300",
    cyan: "bg-cyan-900/40 border-cyan-700 text-cyan-300",
    orange: "bg-orange-900/40 border-orange-700 text-orange-300",
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <span key={i} className={`px-2 py-0.5 rounded text-xs border ${colorMap[color] || colorMap.blue}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function ProfileResults({ data }: { data: Record<string, any> }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
      {/* Fanbase Characteristics */}
      {data.fanbase_characteristics && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 lg:col-span-2">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fanbase Characteristics</h4>
          <p className="text-sm text-gray-300">{data.fanbase_characteristics}</p>
        </div>
      )}

      {/* Demographics */}
      {data.fan_demographics && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Demographics</h4>
          <div className="text-sm text-gray-300 space-y-1">
            <p><span className="text-gray-500">Age:</span> {data.fan_demographics.age_range}</p>
            <p><span className="text-gray-500">Gender:</span> {data.fan_demographics.gender_split}</p>
            {data.fan_demographics.top_locations && (
              <div>
                <span className="text-gray-500">Top Locations:</span>
                <TagList items={data.fan_demographics.top_locations} color="cyan" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Similar Artists */}
      {data.similar_artists?.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Similar Artists</h4>
          <TagList items={data.similar_artists} color="purple" />
        </div>
      )}

      {/* Fan Vocabulary */}
      {data.fan_vocabulary?.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fan Vocabulary</h4>
          <TagList items={data.fan_vocabulary} color="blue" />
        </div>
      )}

      {/* Fan Slang */}
      {data.fan_slang?.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fan Slang</h4>
          <TagList items={data.fan_slang} color="orange" />
        </div>
      )}

      {/* Key Hashtags */}
      {data.key_hashtags?.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Key Hashtags</h4>
          <TagList items={data.key_hashtags} color="cyan" />
        </div>
      )}

      {/* Common Comments */}
      {data.common_comment_patterns?.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 lg:col-span-2">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Common Comment Patterns</h4>
          <div className="space-y-2">
            {data.common_comment_patterns.map((c: string, i: number) => (
              <div key={i} className="bg-gray-900/60 border border-gray-700/50 rounded px-3 py-2 text-sm text-gray-300 italic">
                &ldquo;{c}&rdquo;
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inside Jokes */}
      {data.inside_jokes_references?.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Inside Jokes & References</h4>
          <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
            {data.inside_jokes_references.map((j: string, i: number) => (
              <li key={i}>{j}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Artist Style */}
      {data.artist_style_aesthetic && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Artist Style & Aesthetic</h4>
          <p className="text-sm text-gray-300">{data.artist_style_aesthetic}</p>
        </div>
      )}

      {/* Fanbase Culture */}
      {data.fanbase_culture && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fanbase Culture</h4>
          <p className="text-sm text-gray-300">{data.fanbase_culture}</p>
        </div>
      )}

      {/* Recent Releases */}
      {data.recent_releases?.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Recent Releases</h4>
          <TagList items={data.recent_releases} color="green" />
        </div>
      )}

      {/* Engagement Patterns */}
      {data.engagement_patterns && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Engagement Patterns</h4>
          <div className="text-sm text-gray-300 space-y-1">
            {data.engagement_patterns.peak_activity && (
              <p><span className="text-gray-500">Peak Activity:</span> {data.engagement_patterns.peak_activity}</p>
            )}
            {data.engagement_patterns.typical_behavior && (
              <p><span className="text-gray-500">Typical Behavior:</span> {data.engagement_patterns.typical_behavior}</p>
            )}
            {data.engagement_patterns.comment_length && (
              <p><span className="text-gray-500">Comment Length:</span> {data.engagement_patterns.comment_length}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ArtistProfilesPage() {
  const [profiles, setProfiles] = useState<ArtistProfile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [researchingId, setResearchingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formGenre, setFormGenre] = useState("");
  const [formPlatform, setFormPlatform] = useState("");
  const [formHandles, setFormHandles] = useState<Record<string, string>>({
    instagram: "",
    tiktok: "",
    twitter: "",
    youtube: "",
    spotify: "",
  });

  const load = () => {
    getArtistProfiles()
      .then((d) => setProfiles(d.results || []))
      .catch(console.error);
  };

  useEffect(load, []);

  const resetForm = () => {
    setFormName("");
    setFormGenre("");
    setFormPlatform("");
    setFormHandles({ instagram: "", tiktok: "", twitter: "", youtube: "", spotify: "" });
    setEditingId(null);
  };

  const startEdit = (profile: ArtistProfile) => {
    setFormName(profile.artist_name);
    setFormGenre(profile.genre);
    setFormPlatform(profile.platform);
    setFormHandles({
      instagram: profile.social_handles?.instagram || "",
      tiktok: profile.social_handles?.tiktok || "",
      twitter: profile.social_handles?.twitter || "",
      youtube: profile.social_handles?.youtube || "",
      spotify: profile.social_handles?.spotify || "",
    });
    setEditingId(profile.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    const cleanHandles: Record<string, string> = {};
    for (const [k, v] of Object.entries(formHandles)) {
      if (v.trim()) cleanHandles[k] = v.trim();
    }

    const data = {
      artist_name: formName,
      genre: formGenre,
      platform: formPlatform,
      social_handles: cleanHandles,
    };

    if (editingId) {
      await updateArtistProfile(editingId, data);
    } else {
      await createArtistProfile(data);
    }

    resetForm();
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this artist profile? Projects using it will be unlinked.")) return;
    await deleteArtistProfile(id);
    load();
  };

  const handleResearch = async (id: string) => {
    setResearchingId(id);
    try {
      await runArtistResearch(id);
      load();
    } catch (err) {
      console.error(err);
      load();
    } finally {
      setResearchingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Artist Profiles</h2>
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium"
        >
          {showForm ? "Cancel" : "+ New Profile"}
        </button>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">
            {editingId ? "Edit Profile" : "New Artist Profile"}
          </h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Artist Name *</label>
              <input
                className={inputClass}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Drake, SZA, Bad Bunny"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Genre</label>
              <select className={inputClass} value={formGenre} onChange={(e) => setFormGenre(e.target.value)}>
                {GENRE_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g || "Select genre..."}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Primary Platform</label>
              <select className={inputClass} value={formPlatform} onChange={(e) => setFormPlatform(e.target.value)}>
                {PLATFORM_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p || "Select platform..."}</option>
                ))}
              </select>
            </div>
          </div>

          <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Social Handles</h4>
          <div className="grid grid-cols-5 gap-3 mb-4">
            {["instagram", "tiktok", "twitter", "youtube", "spotify"].map((platform) => (
              <div key={platform}>
                <label className="block text-xs text-gray-500 mb-1 capitalize">{platform}</label>
                <input
                  className={inputClass}
                  value={formHandles[platform] || ""}
                  onChange={(e) => setFormHandles({ ...formHandles, [platform]: e.target.value })}
                  placeholder={`@${platform}`}
                />
              </div>
            ))}
          </div>

          <button
            onClick={handleSave}
            disabled={!formName.trim()}
            className="px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium disabled:opacity-50"
          >
            {editingId ? "Update Profile" : "Create Profile"}
          </button>
        </div>
      )}

      {/* Profiles List */}
      <div className="space-y-3">
        {profiles.map((profile) => {
          const isExpanded = expandedId === profile.id;
          const isResearching = researchingId === profile.id || profile.status === "researching";

          return (
            <div key={profile.id} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              {/* Row */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-800/30"
                onClick={() => setExpandedId(isExpanded ? null : profile.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-white">{profile.artist_name}</span>
                    {profile.genre && (
                      <span className="px-2 py-0.5 bg-purple-900/50 border border-purple-700 rounded text-xs text-purple-300">
                        {profile.genre}
                      </span>
                    )}
                    {profile.platform && (
                      <span className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-400">
                        {profile.platform}
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs border ${STATUS_COLORS[profile.status] || STATUS_COLORS.pending}`}>
                      {isResearching ? "Researching..." : profile.status}
                    </span>
                  </div>
                  {profile.social_handles && Object.keys(profile.social_handles).length > 0 && (
                    <div className="flex gap-2 mt-1">
                      {Object.entries(profile.social_handles).map(([platform, handle]) => (
                        <span key={platform} className="text-xs text-gray-500">
                          {platform}: {handle}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResearch(profile.id);
                    }}
                    disabled={isResearching}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium disabled:opacity-50"
                  >
                    {isResearching ? "Researching..." : profile.status === "completed" ? "Re-run Research" : "Run Research"}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(profile);
                    }}
                    className="text-gray-400 hover:text-white text-xs"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(profile.id);
                    }}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    Delete
                  </button>
                  <span className="text-gray-600 text-sm">{isExpanded ? "\u25B2" : "\u25BC"}</span>
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-gray-800 p-4">
                  {profile.status === "failed" && profile.error_message && (
                    <div className="bg-red-900/20 border border-red-800 rounded p-3 mb-4 text-sm text-red-400">
                      Error: {profile.error_message}
                    </div>
                  )}
                  {profile.status === "completed" && profile.profile_data && Object.keys(profile.profile_data).length > 0 ? (
                    <ProfileResults data={profile.profile_data} />
                  ) : profile.status === "pending" ? (
                    <p className="text-sm text-gray-500">No research data yet. Click &quot;Run Research&quot; to generate a profile.</p>
                  ) : profile.status === "researching" ? (
                    <div className="flex items-center gap-2 text-sm text-yellow-400">
                      <span className="animate-spin">&#9696;</span>
                      Research in progress...
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}

        {profiles.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No artist profiles yet. Create one to start researching an artist&apos;s fanbase.
          </div>
        )}
      </div>
    </div>
  );
}
