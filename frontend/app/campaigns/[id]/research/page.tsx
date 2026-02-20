"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getCampaign, getArtistProfile, runArtistResearch } from "@/lib/api";
import type { ArtistProfile } from "@/lib/types";

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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
              <div>
                <span className="text-gray-500">Top Locations:</span>
                <TagList items={data.fan_demographics.top_locations} color="cyan" />
              </div>
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
            {data.inside_jokes_references.map((j: string, i: number) => (
              <li key={i}>{j}</li>
            ))}
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

export default function CampaignResearchPage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<ArtistProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [researching, setResearching] = useState(false);
  const [noProfile, setNoProfile] = useState(false);

  useEffect(() => {
    setLoading(true);
    getCampaign(id)
      .then((campaign) => {
        if (campaign.artist_profile) {
          return getArtistProfile(campaign.artist_profile).then((p) => {
            setProfile(p);
            setNoProfile(false);
          });
        } else {
          setNoProfile(true);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleResearch = async () => {
    if (!profile) return;
    setResearching(true);
    try {
      const updated = await runArtistResearch(profile.id);
      setProfile(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setResearching(false);
    }
  };

  if (loading) {
    return <div className="text-gray-500">Loading...</div>;
  }

  if (noProfile) {
    return (
      <div>
        <h2 className="text-2xl font-bold mb-6">Artist Research</h2>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-4">
            No artist profile linked to this campaign. Link one in the campaign settings, or create a new profile first.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href={`/campaigns/${id}`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium"
            >
              Campaign Settings
            </Link>
            <Link
              href="/artist-profiles"
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm font-medium"
            >
              Manage Artist Profiles
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Artist Research</h2>
          {profile && (
            <p className="text-gray-400 text-sm mt-1">
              Profile: <span className="text-white">{profile.artist_name}</span>
              {profile.genre && <span className="text-gray-500"> ({profile.genre})</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {profile && (
            <button
              onClick={handleResearch}
              disabled={researching}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium disabled:opacity-50"
            >
              {researching ? "Researching..." : profile.status === "completed" ? "Re-run Research" : "Run Research"}
            </button>
          )}
          <Link
            href="/artist-profiles"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm font-medium"
          >
            Manage Profiles
          </Link>
        </div>
      </div>

      {profile?.status === "failed" && profile.error_message && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6 text-sm text-red-400">
          Research failed: {profile.error_message}
        </div>
      )}

      {profile?.status === "completed" && profile.profile_data && Object.keys(profile.profile_data).length > 0 ? (
        <ProfileResults data={profile.profile_data} />
      ) : profile?.status === "researching" || researching ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <div className="text-yellow-400 text-lg mb-2 animate-spin inline-block">&#9696;</div>
          <p className="text-gray-400">Research in progress... This may take a minute.</p>
        </div>
      ) : profile?.status === "pending" ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-400">Click &quot;Run Research&quot; to generate a detailed artist profile.</p>
        </div>
      ) : null}
    </div>
  );
}
