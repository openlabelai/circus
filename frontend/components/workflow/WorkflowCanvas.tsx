"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import type { WorkflowBlock } from "@/lib/workflow-types";
import SortableBlockList from "./SortableBlockList";

interface Props {
  blocks: WorkflowBlock[];
  selectedBlockId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function WorkflowCanvas({ blocks, selectedBlockId, onSelect, onDelete }: Props) {
  // Make the entire canvas a droppable target for the "root" container
  const { setNodeRef, isOver } = useDroppable({ id: "root" });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-full rounded-lg transition-colors ${isOver ? "bg-blue-500/5" : ""}`}
      onClick={() => onSelect("")}
    >
      {blocks.length === 0 ? (
        <div className={`flex items-center justify-center h-64 border-2 border-dashed rounded-xl transition-colors
          ${isOver ? "border-blue-500 bg-blue-500/10" : "border-gray-800"}`}>
          <p className="text-gray-500 text-sm">
            {isOver ? "Drop here to add" : "Click an action from the palette or drag it here"}
          </p>
        </div>
      ) : (
        <SortableBlockList
          blocks={blocks}
          containerId="root"
          selectedBlockId={selectedBlockId}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}
