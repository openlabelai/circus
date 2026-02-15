"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { WorkflowBlock } from "@/lib/workflow-types";
import BlockCard from "./BlockCard";

interface SortableItemProps {
  block: WorkflowBlock;
  containerId: string;
  selected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  renderChildren: (blocks: WorkflowBlock[], containerId: string, label: string) => React.ReactNode;
}

function SortableItem({ block, containerId, selected, onSelect, onDelete, renderChildren }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: block._id,
    data: { source: "canvas", containerId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <BlockCard
        block={block}
        selected={selected}
        onSelect={() => onSelect(block._id)}
        onDelete={() => onDelete(block._id)}
        renderChildren={renderChildren}
        dragHandleProps={listeners}
      />
    </div>
  );
}

interface Props {
  blocks: WorkflowBlock[];
  containerId: string;
  label?: string;
  selectedBlockId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function SortableBlockList({ blocks, containerId, label, selectedBlockId, onSelect, onDelete }: Props) {
  // Only register a droppable for nested containers (not root — WorkflowCanvas handles root)
  const isRoot = containerId === "root";
  const { setNodeRef, isOver } = useDroppable({ id: containerId, disabled: isRoot });

  const renderChildren = (childBlocks: WorkflowBlock[], childContainerId: string, childLabel: string) => (
    <SortableBlockList
      blocks={childBlocks}
      containerId={childContainerId}
      label={childLabel}
      selectedBlockId={selectedBlockId}
      onSelect={onSelect}
      onDelete={onDelete}
    />
  );

  const content = (
    <SortableContext items={blocks.map((b) => b._id)} strategy={verticalListSortingStrategy}>
      {blocks.map((block) => (
        <SortableItem
          key={block._id}
          block={block}
          containerId={containerId}
          selected={selectedBlockId === block._id}
          onSelect={onSelect}
          onDelete={onDelete}
          renderChildren={renderChildren}
        />
      ))}
    </SortableContext>
  );

  // Root container: just render content (WorkflowCanvas provides the droppable wrapper)
  if (isRoot) {
    return <div className="space-y-1.5">{content}</div>;
  }

  // Nested container: render with droppable, label, and border
  return (
    <div className="mt-2">
      {label && (
        <span className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">{label}</span>
      )}
      <div
        ref={setNodeRef}
        className={`min-h-[36px] rounded border border-dashed transition-colors space-y-1.5 p-1.5
          ${isOver ? "border-blue-500 bg-blue-500/5" : "border-gray-800"}`}
      >
        {content}
        {blocks.length === 0 && (
          <p className="text-[10px] text-gray-600 text-center py-1">Drop actions here</p>
        )}
      </div>
    </div>
  );
}
