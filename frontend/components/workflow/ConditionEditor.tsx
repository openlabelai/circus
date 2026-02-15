"use client";

import type { Condition, ConditionType } from "@/lib/workflow-types";

const inputClass =
  "w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500";
const selectClass =
  "w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500";

interface Props {
  condition: Condition;
  onChange: (cond: Condition) => void;
}

export default function ConditionEditor({ condition, onChange }: Props) {
  const showTextFields = condition.type !== "app_running";
  const showPackage = condition.type === "app_running";

  return (
    <div className="space-y-2">
      <label className="text-xs text-gray-400">Condition Type</label>
      <select
        className={selectClass}
        value={condition.type}
        onChange={(e) => onChange({ ...condition, type: e.target.value as ConditionType })}
      >
        <option value="element_exists">Element Exists</option>
        <option value="element_not_exists">Element Not Exists</option>
        <option value="app_running">App Running</option>
      </select>

      {showTextFields && (
        <>
          <label className="text-xs text-gray-400">Text</label>
          <input
            className={inputClass}
            placeholder="Button text..."
            value={condition.text || ""}
            onChange={(e) => onChange({ ...condition, text: e.target.value })}
          />
          <label className="text-xs text-gray-400">Resource ID (optional)</label>
          <input
            className={inputClass}
            placeholder="com.app:id/btn"
            value={condition.resource_id || ""}
            onChange={(e) => onChange({ ...condition, resource_id: e.target.value })}
          />
        </>
      )}

      {showPackage && (
        <>
          <label className="text-xs text-gray-400">Package</label>
          <input
            className={inputClass}
            placeholder="com.example.app"
            value={condition.package || ""}
            onChange={(e) => onChange({ ...condition, package: e.target.value })}
          />
        </>
      )}
    </div>
  );
}
