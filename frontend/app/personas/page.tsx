"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPersonas, generatePersonas, deletePersona } from "@/lib/api";
import { useProject } from "@/lib/project-context";
import type { PersonaSummary } from "@/lib/types";

export default function PersonasPage() {
  const { activeProject } = useProject();
  const [personas, setPersonas] = useState<PersonaSummary[]>([]);
  const [genCount, setGenCount] = useState(1);
  const [genServices, setGenServices] = useState("instagram,tiktok");
  const [genGenre, setGenGenre] = useState("");
  const [genArchetype, setGenArchetype] = useState("");
  const [genTargetArtist, setGenTargetArtist] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const load = () => {
    getPersonas(activeProject?.id).then((d) => setPersonas(d.results || [])).catch(console.error);
  };

  useEffect(load, [activeProject?.id]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const svcs = genServices.split(",").map((s) => s.trim()).filter(Boolean);
      await generatePersonas(genCount, svcs.length ? svcs : undefined, genGenre || undefined, genArchetype || undefined, genTargetArtist || undefined, activeProject?.id);
      load();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete persona ${id}?`)) return;
    await deletePersona(id);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Personas</h2>
        <Link
          href="/personas/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium"
        >
          + New Persona
        </Link>
      </div>

      {/* Generate section */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6 flex items-end gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Count</label>
          <input
            type="number"
            min={1}
            max={20}
            value={genCount}
            onChange={(e) => setGenCount(Number(e.target.value))}
            className="w-20 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Services</label>
          <input
            value={genServices}
            onChange={(e) => setGenServices(e.target.value)}
            className="w-64 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
            placeholder="instagram,tiktok"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Genre</label>
          <select
            value={genGenre}
            onChange={(e) => setGenGenre(e.target.value)}
            className="w-32 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
          >
            <option value="">Any</option>
            {["hip-hop", "indie-rock", "edm", "r&b", "latin", "k-pop", "pop", "country"].map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Archetype</label>
          <select
            value={genArchetype}
            onChange={(e) => setGenArchetype(e.target.value)}
            className="w-40 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
          >
            <option value="">Any</option>
            <option value="day_one_stan">Day-One Stan</option>
            <option value="casual_viber">Casual Viber</option>
            <option value="content_creator_fan">Content Creator Fan</option>
            <option value="genre_head">Genre Head</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Target Artist</label>
          <input
            value={genTargetArtist}
            onChange={(e) => setGenTargetArtist(e.target.value)}
            className="w-48 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm"
            placeholder="e.g. Drake, SZA"
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-4 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400">
              <th className="text-left p-3">ID</th>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Age</th>
              <th className="text-left p-3">Username</th>
              <th className="text-left p-3">Genre</th>
              <th className="text-left p-3">Services</th>
              <th className="text-left p-3">Device</th>
              <th className="text-left p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {personas.map((p) => (
              <tr key={p.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="p-3 font-mono text-cyan-400">{p.id}</td>
                <td className="p-3">{p.name}</td>
                <td className="p-3">{p.age}</td>
                <td className="p-3">{p.username}</td>
                <td className="p-3">
                  {p.genre && (
                    <span className="px-2 py-0.5 bg-purple-900/50 border border-purple-700 rounded text-xs">{p.genre}</span>
                  )}
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    {p.services.map((s) => (
                      <span key={s} className="px-2 py-0.5 bg-gray-800 rounded text-xs">
                        {s}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="p-3 font-mono text-xs">{p.assigned_device || "-"}</td>
                <td className="p-3 flex gap-2">
                  <Link
                    href={`/personas/${p.id}`}
                    className="text-blue-400 hover:text-blue-300 text-xs"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-red-400 hover:text-red-300 text-xs"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {personas.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-500">
                  No personas yet. Generate some or create one manually.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
