"use client";

import { useEffect, useState } from "react";
import {
  getLLMConfigs,
  getLLMProviders,
  updateLLMConfig,
  getProviderKeys,
  setProviderKey,
  deleteProviderKey,
} from "@/lib/api";
import type { LLMConfig, LLMProvider, ProviderKeyInfo } from "@/lib/types";

const PURPOSE_LABELS: Record<string, string> = {
  persona_enrichment: "Persona Enrichment",
  vision: "Vision & Recovery",
  comment_generation: "Comment Generation",
  content_generation: "Content Generation",
  artist_research: "Artist Research",
};

export default function SettingsPage() {
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [dirty, setDirty] = useState<Record<number, Partial<LLMConfig>>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // API Keys state
  const [keys, setKeys] = useState<ProviderKeyInfo[]>([]);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [spotifySecret, setSpotifySecret] = useState("");
  const [keySaving, setKeySaving] = useState<string | null>(null);

  function loadAll() {
    getLLMConfigs().then(setConfigs).catch(console.error);
    getLLMProviders().then(setProviders).catch(console.error);
    getProviderKeys().then(setKeys).catch(console.error);
  }

  useEffect(loadAll, []);

  // --- API Keys handlers ---

  async function handleSaveKey(provider: string) {
    let value = keyInputs[provider];
    if (provider === "spotify") {
      if (!value || !spotifySecret) return;
      value = `${value}:${spotifySecret}`;
    }
    if (!value) return;
    setKeySaving(provider);
    try {
      await setProviderKey(provider, value);
      setKeyInputs((prev) => ({ ...prev, [provider]: "" }));
      if (provider === "spotify") setSpotifySecret("");
      // Refresh keys and providers to update has_key status
      const [newKeys, newProviders] = await Promise.all([
        getProviderKeys(),
        getLLMProviders(),
      ]);
      setKeys(newKeys);
      setProviders(newProviders);
    } catch (e: any) {
      console.error(e);
    } finally {
      setKeySaving(null);
    }
  }

  async function handleDeleteKey(provider: string) {
    setKeySaving(provider);
    try {
      await deleteProviderKey(provider);
      const [newKeys, newProviders] = await Promise.all([
        getProviderKeys(),
        getLLMProviders(),
      ]);
      setKeys(newKeys);
      setProviders(newProviders);
    } catch (e: any) {
      console.error(e);
    } finally {
      setKeySaving(null);
    }
  }

  // --- LLM Config handlers ---

  function getModels(providerId: string): string[] {
    return providers.find((p) => p.id === providerId)?.models || [];
  }

  function handleChange(config: LLMConfig, field: string, value: string | boolean | number) {
    const patch = { ...dirty[config.id], [field]: value };
    if (field === "provider") {
      const models = getModels(value as string);
      patch.model = models[0] || "";
    }
    setDirty({ ...dirty, [config.id]: patch });
  }

  function effective(config: LLMConfig): LLMConfig {
    return { ...config, ...dirty[config.id] };
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const updates = Object.entries(dirty).map(([id, patch]) =>
        updateLLMConfig(Number(id), patch)
      );
      const results = await Promise.all(updates);
      setConfigs((prev) =>
        prev.map((c) => {
          const updated = results.find((r) => r.id === c.id);
          return updated || c;
        })
      );
      setDirty({});
      setMessage("Saved successfully");
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }

  const hasDirty = Object.keys(dirty).length > 0;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Settings</h2>

      {/* API Keys Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">API Keys</h3>
        <p className="text-sm text-gray-400 mb-4">
          Keys are stored in the database. Environment variables work as fallback.
        </p>

        {[
          { title: "LLM Providers", items: keys.filter((k) => !["youtube", "spotify", "lastfm"].includes(k.provider)) },
          { title: "Service APIs", items: keys.filter((k) => ["youtube", "spotify", "lastfm"].includes(k.provider)) },
        ].map(({ title, items }) => items.length > 0 && (
          <div key={title} className="mb-5">
            <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">{title}</h4>
            <div className="space-y-3">
              {items.map((k) => (
                <div key={k.provider} className="flex items-center gap-3">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      k.has_key ? "bg-green-400" : "bg-gray-600"
                    }`}
                  />
                  <span className="w-40 text-sm font-medium">{k.label}</span>

                  {k.has_key && !(k.provider in keyInputs) ? (
                    <div className="flex items-center gap-2 flex-1">
                      <span className="text-sm text-gray-500 font-mono">
                        {k.masked_key}
                      </span>
                      <button
                        onClick={() =>
                          setKeyInputs((prev) => ({ ...prev, [k.provider]: "" }))
                        }
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Change
                      </button>
                      <button
                        onClick={() => handleDeleteKey(k.provider)}
                        disabled={keySaving === k.provider}
                        className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        {keySaving === k.provider ? "..." : "Remove"}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-1">
                      {k.provider === "spotify" ? (
                        <>
                          <input
                            type="password"
                            placeholder="Client ID"
                            value={keyInputs[k.provider] || ""}
                            onChange={(e) =>
                              setKeyInputs((prev) => ({
                                ...prev,
                                [k.provider]: e.target.value,
                              }))
                            }
                            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono"
                          />
                          <input
                            type="password"
                            placeholder="Client Secret"
                            value={spotifySecret}
                            onChange={(e) => setSpotifySecret(e.target.value)}
                            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono"
                          />
                        </>
                      ) : (
                        <input
                          type="password"
                          placeholder="Enter API key..."
                          value={keyInputs[k.provider] || ""}
                          onChange={(e) =>
                            setKeyInputs((prev) => ({
                              ...prev,
                              [k.provider]: e.target.value,
                            }))
                          }
                          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm font-mono"
                        />
                      )}
                      <button
                        onClick={() => handleSaveKey(k.provider)}
                        disabled={
                          keySaving === k.provider ||
                          !keyInputs[k.provider] ||
                          (k.provider === "spotify" && !spotifySecret)
                        }
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-xs font-medium"
                      >
                        {keySaving === k.provider ? "..." : "Save"}
                      </button>
                      {k.has_key && (
                        <button
                          onClick={() => {
                            setKeyInputs((prev) => {
                              const next = { ...prev };
                              delete next[k.provider];
                              return next;
                            });
                            if (k.provider === "spotify") setSpotifySecret("");
                          }}
                          className="text-xs text-gray-400 hover:text-gray-300"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* LLM Configuration Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">LLM Configuration</h3>

        <div className="mb-4">
          <span className="text-sm text-gray-400 mr-2">Provider Keys Detected:</span>
          {providers.map((p) => (
            <span
              key={p.id}
              className={`inline-flex items-center gap-1 mr-3 text-sm ${
                p.has_key ? "text-green-400" : "text-gray-500"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${p.has_key ? "bg-green-400" : "bg-gray-600"}`} />
              {p.label}
            </span>
          ))}
        </div>

        <div className="space-y-4">
          {configs.map((config) => {
            const eff = effective(config);
            const models = getModels(eff.provider);

            return (
              <div
                key={config.id}
                className="border border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">
                    {PURPOSE_LABELS[config.purpose] || config.purpose}
                  </h4>
                  <label className="flex items-center gap-2 text-sm text-gray-400">
                    <input
                      type="checkbox"
                      checked={eff.enabled}
                      onChange={(e) =>
                        handleChange(config, "enabled", e.target.checked)
                      }
                      className="rounded"
                    />
                    Enabled
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Provider
                    </label>
                    <select
                      value={eff.provider}
                      onChange={(e) =>
                        handleChange(config, "provider", e.target.value)
                      }
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
                    >
                      <option value="">Not configured</option>
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}{p.has_key ? "" : " (no key)"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Model
                    </label>
                    <select
                      value={eff.model}
                      onChange={(e) =>
                        handleChange(config, "model", e.target.value)
                      }
                      disabled={!eff.provider}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm disabled:opacity-50"
                    >
                      <option value="">—</option>
                      {models.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1">
                      Max Tokens
                    </label>
                    <input
                      type="number"
                      value={eff.max_tokens}
                      onChange={(e) =>
                        handleChange(config, "max_tokens", parseInt(e.target.value) || 0)
                      }
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-6">
          <button
            onClick={handleSave}
            disabled={!hasDirty || saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-sm font-medium"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          {message && (
            <span
              className={`text-sm ${
                message.startsWith("Error") ? "text-red-400" : "text-green-400"
              }`}
            >
              {message}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
