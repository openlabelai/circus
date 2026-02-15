"use client";

import yaml from "js-yaml";
import type { TaskMetadata, WorkflowBlock } from "@/lib/workflow-types";
import { blocksToActions } from "@/lib/workflow-utils";

interface Props {
  open: boolean;
  onClose: () => void;
  metadata: TaskMetadata;
  blocks: WorkflowBlock[];
}

export default function YamlPreviewModal({ open, onClose, metadata, blocks }: Props) {
  if (!open) return null;

  const taskData = {
    name: metadata.name,
    description: metadata.description || undefined,
    target_package: metadata.target_package || undefined,
    timeout: metadata.timeout,
    retry_count: metadata.retry_count || undefined,
    actions: blocksToActions(blocks),
  };

  const yamlStr = yaml.dump(taskData, { noRefs: true, sortKeys: false, lineWidth: 120 });

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-[700px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-gray-200">YAML Preview</h3>
          <div className="flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(yamlStr)}
              className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
            >
              Copy
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">✕</button>
          </div>
        </div>
        <pre className="flex-1 overflow-auto p-5 text-xs text-gray-300 font-mono whitespace-pre-wrap">{yamlStr}</pre>
      </div>
    </div>
  );
}
