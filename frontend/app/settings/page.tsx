"use client";

import { useEffect, useState } from "react";
import { getLLMConfigs, getLLMProviders, updateLLMConfig } from "@/lib/api";
import type { LLMConfig, LLMProvider } from "@/lib/types";

const PURPOSE_LABELS: Record<string, string> = {
  persona_enrichment: "Persona Enrichment",
  vision: "Vision & Recovery",
  comment_generation: "Comment Generation",
  content_generation: "Content Generation",
};

export default function SettingsPage() {
  const [configs, setConfigs] = useState<LLMConfig[]>([]);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [dirty, setDirty] = useState<Record<number, Partial<LLMConfig>>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getLLMConfigs().then(setConfigs).catch(console.error);
    getLLMProviders().then(setProviders).catch(console.error);
  }, []);

  const providersWithKey = providers.filter((p) => p.has_key);

  function getModels(providerId: string): string[] {
    return providers.find((p) => p.id === providerId)?.models || [];
  }

  function handleChange(config: LLMConfig, field: string, value: string | boolean | number) {
    const patch = { ...dirty[config.id], [field]: value };

    // When provider changes, reset model to first available
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
      // Merge results back
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
                      {providersWithKey.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
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
