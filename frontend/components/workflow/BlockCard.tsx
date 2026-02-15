"use client";

import React from "react";
import type { WorkflowBlock } from "@/lib/workflow-types";
import { ACTION_COLORS, PALETTE_CATEGORIES } from "@/lib/workflow-types";
import { blockSummary, isControlFlow } from "@/lib/workflow-utils";

function getIcon(action: string): string {
  for (const cat of PALETTE_CATEGORIES) {
    for (const item of cat.items) {
      if (item.type === action) return item.icon;
    }
  }
  return "?";
}

function getLabel(action: string): string {
  for (const cat of PALETTE_CATEGORIES) {
    for (const item of cat.items) {
      if (item.type === action) return item.label;
    }
  }
  return action;
}

const colorBorder: Record<string, string> = {
  blue: "border-l-blue-500",
  green: "border-l-green-500",
  purple: "border-l-purple-500",
  amber: "border-l-amber-500",
};

const colorBg: Record<string, string> = {
  blue: "bg-blue-500/10",
  green: "bg-green-500/10",
  purple: "bg-purple-500/10",
  amber: "bg-amber-500/10",
};

const colorHeader: Record<string, string> = {
  blue: "bg-blue-500/20",
  green: "bg-green-500/20",
  purple: "bg-purple-500/20",
  amber: "bg-amber-500/20",
};

interface Props {
  block: WorkflowBlock;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  renderChildren: (blocks: WorkflowBlock[], containerId: string, label: string) => React.ReactNode;
  dragHandleProps?: Record<string, any>;
}

export default function BlockCard({ block, selected, onSelect, onDelete, renderChildren, dragHandleProps }: Props) {
  const color = ACTION_COLORS[block.action] || "gray";
  const summary = blockSummary(block);
  const controlFlow = isControlFlow(block.action);

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      className={`rounded-lg border-l-4 ${colorBorder[color]} ${colorBg[color]} border border-gray-800
        ${selected ? "ring-2 ring-blue-500" : ""} transition-all`}
    >
      {/* Header */}
      <div className={`flex items-center gap-2 px-3 py-2 ${controlFlow ? colorHeader[color] + " rounded-t-lg" : ""}`}>
        <span
          {...(dragHandleProps || {})}
          className="cursor-grab active:cursor-grabbing text-gray-500 hover:text-gray-300"
          title="Drag to reorder"
        >
          ⠿
        </span>
        <span className="text-sm">{getIcon(block.action)}</span>
        <span className="text-xs font-semibold text-gray-200">{getLabel(block.action)}</span>
        {summary && <span className="text-xs text-gray-400 truncate flex-1 font-mono">{summary}</span>}
        {!summary && <span className="flex-1" />}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-gray-500 hover:text-red-400 text-xs ml-2"
          title="Delete"
        >
          ✕
        </button>
      </div>

      {/* Nested children for control flow blocks */}
      {controlFlow && (
        <div className="px-3 pb-2">
          {block.action === "if" && (
            <>
              {renderChildren(block.then || [], `${block._id}:then`, "Then")}
              {renderChildren(block.else || [], `${block._id}:else`, "Else")}
            </>
          )}
          {(block.action === "repeat" || block.action === "while") && (
            renderChildren(block.actions || [], `${block._id}:actions`, "Actions")
          )}
          {block.action === "try" && (
            <>
              {renderChildren(block.actions || [], `${block._id}:actions`, "Try")}
              {renderChildren(block.on_error || [], `${block._id}:on_error`, "On Error")}
            </>
          )}
        </div>
      )}
    </div>
  );
}
