"use client";

import type { TaskMetadata } from "@/lib/workflow-types";

const inputClass =
  "w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:border-blue-500";

interface Props {
  metadata: TaskMetadata;
  onChange: (updates: Partial<TaskMetadata>) => void;
  onSave: () => void;
  onExport: () => void;
  saving: boolean;
  isDirty: boolean;
  isNew: boolean;
}

export default function TaskMetadataBar({ metadata, onChange, onSave, onExport, saving, isDirty, isNew }: Props) {
  return (
    <div className="flex items-center gap-4">
      <input
        className={`${inputClass} max-w-xs font-semibold`}
        placeholder="Task name"
        value={metadata.name}
        onChange={(e) => onChange({ name: e.target.value })}
      />
      <input
        className={`${inputClass} flex-1`}
        placeholder="Description"
        value={metadata.description}
        onChange={(e) => onChange({ description: e.target.value })}
      />
      <input
        className={`${inputClass} max-w-[200px] font-mono text-xs`}
        placeholder="com.example.app"
        value={metadata.target_package}
        onChange={(e) => onChange({ target_package: e.target.value })}
      />
      <label className="flex items-center gap-1 text-xs text-gray-400 whitespace-nowrap">
        Timeout
        <input
          type="number"
          className={`${inputClass} w-16`}
          value={metadata.timeout}
          onChange={(e) => onChange({ timeout: Number(e.target.value) })}
        />
      </label>
      <button
        onClick={onExport}
        className="px-3 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300 whitespace-nowrap"
      >
        YAML
      </button>
      <button
        onClick={onSave}
        disabled={saving || !metadata.name}
        className="px-4 py-1.5 text-xs rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium whitespace-nowrap"
      >
        {saving ? "Saving..." : isNew ? "Create" : "Save"}
      </button>
      {isDirty && <span className="text-xs text-amber-400">unsaved</span>}
    </div>
  );
}
