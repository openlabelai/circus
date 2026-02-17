"use client";

import { useEffect, useState } from "react";
import {
  getArtistProfiles,
  createArtistProfile,
  updateArtistProfile,
  deleteArtistProfile,
  runArtistResearch,
  fetchArtistComments,
  enrichArtistAPIs,
} from "@/lib/api";
import type { ArtistProfile } from "@/lib/types";

const GENRE_OPTIONS = [
  "", "hip-hop", "indie-rock", "edm", "r&b", "latin", "k-pop", "pop", "country",
  "jazz", "classical", "metal", "punk", "folk", "reggaeton", "afrobeats",
];

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
      {data.fanbase_characteristics && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 lg:col-span-2">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fanbase Characteristics</h4>
          <p className="text-sm text-gray-300">{data.fanbase_characteristics}</p>
        </div>
      )}
      {data.fan_demographics && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Demographics</h4>
          <div className="text-sm text-gray-300 space-y-1">
            <p><span className="text-gray-500">Age:</span> {data.fan_demographics.age_range}</p>
            <p><span className="text-gray-500">Gender:</span> {data.fan_demographics.gender_split}</p>
            {data.fan_demographics.top_locations && (
              <div><span className="text-gray-500">Top Locations:</span> <TagList items={data.fan_demographics.top_locations} color="cyan" /></div>
            )}
          </div>
        </div>
      )}
      {data.similar_artists?.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Similar Artists</h4>
          <TagList items={data.similar_artists} color="purple" />
        </div>
      )}
      {data.fan_vocabulary?.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fan Vocabulary</h4>
          <TagList items={data.fan_vocabulary} color="blue" />
        </div>
      )}
      {data.fan_slang?.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fan Slang</h4>
          <TagList items={data.fan_slang} color="orange" />
        </div>
      )}
      {data.key_hashtags?.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Key Hashtags</h4>
          <TagList items={data.key_hashtags} color="cyan" />
        </div>
      )}
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
      {data.inside_jokes_references?.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Inside Jokes & References</h4>
          <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
            {data.inside_jokes_references.map((j: string, i: number) => <li key={i}>{j}</li>)}
          </ul>
        </div>
      )}
      {data.artist_style_aesthetic && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Artist Style & Aesthetic</h4>
          <p className="text-sm text-gray-300">{data.artist_style_aesthetic}</p>
        </div>
      )}
      {data.fanbase_culture && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fanbase Culture</h4>
          <p className="text-sm text-gray-300">{data.fanbase_culture}</p>
        </div>
      )}
      {data.recent_releases?.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Recent Releases</h4>
          <TagList items={data.recent_releases} color="green" />
        </div>
      )}
      {data.engagement_patterns && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Engagement Patterns</h4>
          <div className="text-sm text-gray-300 space-y-1">
            {data.engagement_patterns.peak_activity && <p><span className="text-gray-500">Peak Activity:</span> {data.engagement_patterns.peak_activity}</p>}
            {data.engagement_patterns.typical_behavior && <p><span className="text-gray-500">Typical Behavior:</span> {data.engagement_patterns.typical_behavior}</p>}
            {data.engagement_patterns.comment_length && <p><span className="text-gray-500">Comment Length:</span> {data.engagement_patterns.comment_length}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

interface FormState {
  artist_name: string;
  spotify_url: string;
  country: string;
  city: string;
  genre: string;
  instagram_handle: string;
  youtube_url: string;
  tiktok_handle: string;
  twitter_handle: string;
  description: string;
}

const emptyForm: FormState = {
  artist_name: "",
  spotify_url: "",
  country: "",
  city: "",
  genre: "",
  instagram_handle: "",
  youtube_url: "",
  tiktok_handle: "",
  twitter_handle: "",
  description: "",
};

export default function ArtistProfilesPage() {
  const [profiles, setProfiles] = useState<ArtistProfile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [researchingId, setResearchingId] = useState<string | null>(null);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const set = (key: keyof FormState, value: string) => setForm({ ...form, [key]: value });

  const isFormValid = form.artist_name.trim() && form.spotify_url.trim() && form.country.trim() && form.genre.trim();

  const load = () => {
    getArtistProfiles()
      .then((d) => setProfiles(d.results || []))
      .catch(console.error);
  };

  useEffect(load, []);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const startEdit = (profile: ArtistProfile) => {
    setForm({
      artist_name: profile.artist_name,
      spotify_url: profile.spotify_url,
      country: profile.country,
      city: profile.city,
      genre: profile.genre,
      instagram_handle: profile.instagram_handle,
      youtube_url: profile.youtube_url,
      tiktok_handle: profile.tiktok_handle,
      twitter_handle: profile.twitter_handle,
      description: profile.description,
    });
    setEditingId(profile.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (editingId) {
      await updateArtistProfile(editingId, form);
    } else {
      await createArtistProfile(form);
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

  const handleFetchComments = async (id: string, source: "youtube" | "instagram") => {
    setFetchingId(id);
    try {
      await fetchArtistComments(id, source);
      load();
    } catch (err) {
      console.error(err);
      load();
    } finally {
      setFetchingId(null);
    }
  };

  const handleEnrich = async (id: string) => {
    setEnrichingId(id);
    try {
      await enrichArtistAPIs(id);
      load();
    } catch (err) {
      console.error(err);
      load();
    } finally {
      setEnrichingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Artist Profiles</h2>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
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

          {/* Identity — Required */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
              Identity <span className="text-red-400">*</span>
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Artist / Stage Name *</label>
                <input className={inputClass} value={form.artist_name} onChange={(e) => set("artist_name", e.target.value)} placeholder="e.g. Nadira" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Spotify Artist URL *</label>
                <input className={inputClass} value={form.spotify_url} onChange={(e) => set("spotify_url", e.target.value)} placeholder="https://open.spotify.com/artist/..." />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Country *</label>
                <input className={inputClass} value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="e.g. Indonesia" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Genre *</label>
                <select className={inputClass} value={form.genre} onChange={(e) => set("genre", e.target.value)}>
                  {GENRE_OPTIONS.map((g) => <option key={g} value={g}>{g || "Select genre..."}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Location</h4>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">City</label>
                <input className={inputClass} value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Jakarta" />
              </div>
            </div>
          </div>

          {/* Social Profiles */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Social Profiles</h4>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Instagram</label>
                <input className={inputClass} value={form.instagram_handle} onChange={(e) => set("instagram_handle", e.target.value)} placeholder="@handle" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">YouTube</label>
                <input className={inputClass} value={form.youtube_url} onChange={(e) => set("youtube_url", e.target.value)} placeholder="https://youtube.com/@..." />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">TikTok</label>
                <input className={inputClass} value={form.tiktok_handle} onChange={(e) => set("tiktok_handle", e.target.value)} placeholder="@handle" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Twitter / X</label>
                <input className={inputClass} value={form.twitter_handle} onChange={(e) => set("twitter_handle", e.target.value)} placeholder="@handle" />
              </div>
            </div>
          </div>

          {/* Additional Context */}
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Additional Context</h4>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Description</label>
              <textarea
                className={inputClass + " h-16 resize-none"}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Brief bio — e.g. &quot;Indonesian indie-pop artist known for dreamy vocals and lo-fi production&quot;"
              />
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={!isFormValid}
            className="px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium disabled:opacity-50"
          >
            {editingId ? "Update Profile" : "Create Profile"}
          </button>
          {!isFormValid && (
            <span className="ml-3 text-xs text-gray-500">Fill in all required fields (Artist Name, Spotify URL, Country, Genre)</span>
          )}
        </div>
      )}

      {/* Profiles List */}
      <div className="space-y-3">
        {profiles.map((profile) => {
          const isExpanded = expandedId === profile.id;
          const isResearching = researchingId === profile.id || profile.status === "researching";
          const isFetching = fetchingId === profile.id;
          const isEnriching = enrichingId === profile.id;

          const ytComments = (profile.scraped_comments || []).filter((c) => c.source === "youtube").length;
          const igComments = (profile.scraped_comments || []).filter((c) => c.source === "instagram").length;
          const totalComments = ytComments + igComments;
          const hasApiData = profile.api_data && Object.keys(profile.api_data).length > 0;

          return (
            <div key={profile.id} className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-800/30"
                onClick={() => setExpandedId(isExpanded ? null : profile.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-white">{profile.artist_name}</span>
                    {profile.genre && (
                      <span className="px-2 py-0.5 bg-purple-900/50 border border-purple-700 rounded text-xs text-purple-300">{profile.genre}</span>
                    )}
                    {profile.country && (
                      <span className="px-2 py-0.5 bg-gray-800 border border-gray-700 rounded text-xs text-gray-400">{profile.country}</span>
                    )}
                    <span className={`px-2 py-0.5 rounded text-xs border ${STATUS_COLORS[profile.status] || STATUS_COLORS.pending}`}>
                      {isResearching ? "Researching..." : profile.status}
                    </span>
                    {totalComments > 0 && (
                      <span className="px-2 py-0.5 bg-cyan-900/40 border border-cyan-700 rounded text-xs text-cyan-300">
                        {totalComments} comments
                      </span>
                    )}
                    {hasApiData && (
                      <span className="px-2 py-0.5 bg-green-900/40 border border-green-700 rounded text-xs text-green-300">
                        enriched
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-gray-500">
                    {profile.spotify_url && <span>Spotify</span>}
                    {profile.instagram_handle && <span>IG: {profile.instagram_handle}</span>}
                    {profile.tiktok_handle && <span>TT: {profile.tiktok_handle}</span>}
                    {profile.youtube_url && <span>YouTube</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleResearch(profile.id); }}
                    disabled={isResearching}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium disabled:opacity-50"
                  >
                    {isResearching ? "Researching..." : totalComments > 0 ? `Run Research (${totalComments} real comments)` : profile.status === "completed" ? "Re-run Research" : "Run Research"}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); startEdit(profile); }} className="text-gray-400 hover:text-white text-xs">Edit</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(profile.id); }} className="text-red-400 hover:text-red-300 text-xs">Delete</button>
                  <span className="text-gray-600 text-sm">{isExpanded ? "\u25B2" : "\u25BC"}</span>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-800 p-4">
                  {/* Data Collection Buttons */}
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    {profile.youtube_url && (
                      <button
                        onClick={() => handleFetchComments(profile.id, "youtube")}
                        disabled={isFetching}
                        className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 rounded text-xs font-medium disabled:opacity-50"
                      >
                        {isFetching ? "Fetching..." : "Fetch YouTube Comments"}
                        {ytComments > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-red-900 rounded">{ytComments}</span>}
                      </button>
                    )}
                    {profile.instagram_handle && (
                      <button
                        onClick={() => handleFetchComments(profile.id, "instagram")}
                        disabled={isFetching}
                        className="px-3 py-1.5 bg-pink-600/80 hover:bg-pink-600 rounded text-xs font-medium disabled:opacity-50"
                      >
                        {isFetching ? "Scraping..." : "Scrape Instagram Comments"}
                        {igComments > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-pink-900 rounded">{igComments}</span>}
                      </button>
                    )}
                    <button
                      onClick={() => handleEnrich(profile.id)}
                      disabled={isEnriching}
                      className="px-3 py-1.5 bg-green-600/80 hover:bg-green-600 rounded text-xs font-medium disabled:opacity-50"
                    >
                      {isEnriching ? "Enriching..." : "Enrich from APIs"}
                    </button>
                    {hasApiData && (
                      <div className="flex gap-1.5 ml-2">
                        {profile.api_data.lastfm && <span className="px-2 py-0.5 bg-red-900/30 border border-red-800 rounded text-xs text-red-300">Last.fm</span>}
                        {profile.api_data.spotify && <span className="px-2 py-0.5 bg-green-900/30 border border-green-800 rounded text-xs text-green-300">Spotify</span>}
                        {profile.api_data.genius && <span className="px-2 py-0.5 bg-yellow-900/30 border border-yellow-800 rounded text-xs text-yellow-300">Genius</span>}
                        {profile.api_data.youtube && <span className="px-2 py-0.5 bg-red-900/30 border border-red-800 rounded text-xs text-red-300">YouTube</span>}
                      </div>
                    )}
                  </div>

                  {/* Data Summary */}
                  {(totalComments > 0 || hasApiData) && (
                    <div className="bg-gray-800/30 border border-gray-700/50 rounded p-3 mb-4 text-xs text-gray-400 space-y-1">
                      {ytComments > 0 && <p>{ytComments} YouTube comments</p>}
                      {igComments > 0 && <p>{igComments} Instagram comments</p>}
                      {profile.api_data?.lastfm?.similar_artists && (
                        <p>Similar artists: {profile.api_data.lastfm.similar_artists.length} from Last.fm</p>
                      )}
                      {profile.api_data?.spotify?.genres?.length > 0 && (
                        <p>Genres: {profile.api_data.spotify.genres.join(", ")}</p>
                      )}
                      {profile.api_data?.lastfm?.tags?.length > 0 && (
                        <p>Tags: {profile.api_data.lastfm.tags.slice(0, 8).join(", ")}</p>
                      )}
                      {profile.last_scraped_at && (
                        <p>Last scraped: {new Date(profile.last_scraped_at).toLocaleString()}</p>
                      )}
                    </div>
                  )}

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
                      <span className="animate-spin">&#9696;</span> Research in progress...
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
