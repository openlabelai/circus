"use client";

import React, { useReducer, useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  rectIntersection,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import type { WorkflowBlock, TaskMetadata, ActionType } from "@/lib/workflow-types";
import {
  actionsToBlocks,
  blocksToActions,
  createEmptyBlock,
  findAndUpdate,
  findAndRemove,
  findBlock,
  insertBlock,
  removeFromContainer,
  defaultMetadata,
} from "@/lib/workflow-utils";
import EditorLayout from "./EditorLayout";
import TaskMetadataBar from "./TaskMetadataBar";
import BlockPalette from "./BlockPalette";
import WorkflowCanvas from "./WorkflowCanvas";
import PropertyPanel from "./PropertyPanel";
import YamlPreviewModal from "./YamlPreviewModal";
import type { Task } from "@/lib/types";

// --- State ---

interface EditorState {
  metadata: TaskMetadata;
  blocks: WorkflowBlock[];
  selectedBlockId: string | null;
  isDirty: boolean;
}

type EditorAction =
  | { type: "SET_METADATA"; payload: Partial<TaskMetadata> }
  | { type: "SET_BLOCKS"; payload: WorkflowBlock[] }
  | { type: "ADD_BLOCK"; payload: { block: WorkflowBlock; containerId: string; index: number } }
  | { type: "MOVE_BLOCK"; payload: { blockId: string; fromContainerId: string; toContainerId: string; newIndex: number } }
  | { type: "UPDATE_BLOCK"; payload: { id: string; changes: Partial<WorkflowBlock> } }
  | { type: "DELETE_BLOCK"; payload: string }
  | { type: "SELECT_BLOCK"; payload: string | null }
  | { type: "LOAD_TASK"; payload: Task }
  | { type: "MARK_CLEAN" };

function reducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "SET_METADATA":
      return { ...state, metadata: { ...state.metadata, ...action.payload }, isDirty: true };
    case "SET_BLOCKS":
      return { ...state, blocks: action.payload, isDirty: true };
    case "ADD_BLOCK": {
      const { block, containerId, index } = action.payload;
      return { ...state, blocks: insertBlock(state.blocks, containerId, block, index), isDirty: true, selectedBlockId: block._id };
    }
    case "MOVE_BLOCK": {
      const { blockId, fromContainerId, toContainerId, newIndex } = action.payload;
      const block = findBlock(state.blocks, blockId);
      if (!block) return state;
      let blocks = removeFromContainer(state.blocks, fromContainerId, blockId);
      blocks = insertBlock(blocks, toContainerId, block, newIndex);
      return { ...state, blocks, isDirty: true };
    }
    case "UPDATE_BLOCK":
      return {
        ...state,
        blocks: findAndUpdate(state.blocks, action.payload.id, (b) => ({ ...b, ...action.payload.changes })),
        isDirty: true,
      };
    case "DELETE_BLOCK": {
      const newBlocks = findAndRemove(state.blocks, action.payload);
      const sel = state.selectedBlockId === action.payload ? null : state.selectedBlockId;
      return { ...state, blocks: newBlocks, selectedBlockId: sel, isDirty: true };
    }
    case "SELECT_BLOCK":
      return { ...state, selectedBlockId: action.payload };
    case "LOAD_TASK": {
      const t = action.payload;
      return {
        metadata: {
          name: t.name,
          description: t.description,
          target_package: t.target_package,
          timeout: t.timeout,
          retry_count: t.retry_count,
        },
        blocks: actionsToBlocks(t.actions),
        selectedBlockId: null,
        isDirty: false,
      };
    }
    case "MARK_CLEAN":
      return { ...state, isDirty: false };
    default:
      return state;
  }
}

// --- Component ---

interface Props {
  initialTask?: Task;
  onSave: (data: { name: string; description: string; target_package: string; timeout: number; retry_count: number; actions: Record<string, any>[] }) => Promise<void>;
  isNew: boolean;
}

export default function TaskEditor({ initialTask, onSave, isNew }: Props) {
  const [state, dispatch] = useReducer(reducer, {
    metadata: initialTask
      ? {
          name: initialTask.name,
          description: initialTask.description,
          target_package: initialTask.target_package,
          timeout: initialTask.timeout,
          retry_count: initialTask.retry_count,
        }
      : defaultMetadata(),
    blocks: initialTask ? actionsToBlocks(initialTask.actions) : [],
    selectedBlockId: null,
    isDirty: false,
  });

  const [saving, setSaving] = useState(false);
  const [showYaml, setShowYaml] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...state.metadata,
        actions: blocksToActions(state.blocks),
      });
      dispatch({ type: "MARK_CLEAN" });
    } catch (e) {
      console.error("Save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  // Click-to-add from palette
  const handlePaletteClick = useCallback((actionType: ActionType) => {
    const newBlock = createEmptyBlock(actionType);
    dispatch({
      type: "ADD_BLOCK",
      payload: { block: newBlock, containerId: "root", index: 999 },
    });
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overId = String(over.id);

    if (activeData?.source === "palette") {
      // Dropping from palette
      const actionType = activeData.actionType as ActionType;
      const newBlock = createEmptyBlock(actionType);

      let containerId = "root";
      let index = state.blocks.length;

      if (overId.includes(":")) {
        // Dropped on a nested container (e.g., "abc123:then")
        containerId = overId;
        const [parentId, field] = overId.split(":");
        const parent = findBlock(state.blocks, parentId);
        if (parent) {
          const list = (parent as any)[field] || [];
          index = list.length;
        } else {
          index = 0;
        }
      } else if (overId === "root") {
        index = state.blocks.length;
      } else {
        // Dropped over an existing block — insert after it
        const overData = over.data.current;
        containerId = overData?.sortable?.containerId || "root";
        const overIndex = overData?.sortable?.index;
        index = overIndex !== undefined ? overIndex + 1 : state.blocks.length;
      }

      dispatch({ type: "ADD_BLOCK", payload: { block: newBlock, containerId, index } });
    } else if (activeData?.source === "canvas") {
      // Reordering within canvas
      if (active.id === over.id) return;

      const fromContainerId = activeData.containerId || "root";
      const overData = over.data.current;

      let toContainerId: string;
      let newIndex: number;

      if (overId.includes(":")) {
        toContainerId = overId;
        const [parentId, field] = overId.split(":");
        const parent = findBlock(state.blocks, parentId);
        newIndex = parent ? ((parent as any)[field] || []).length : 0;
      } else {
        toContainerId = overData?.sortable?.containerId || "root";
        newIndex = overData?.sortable?.index ?? 0;
      }

      dispatch({
        type: "MOVE_BLOCK",
        payload: {
          blockId: String(active.id),
          fromContainerId,
          toContainerId,
          newIndex,
        },
      });
    }
  };

  const selectedBlock = state.selectedBlockId ? findBlock(state.blocks, state.selectedBlockId) : null;

  const handleSelect = useCallback((id: string) => {
    dispatch({ type: "SELECT_BLOCK", payload: id || null });
  }, []);

  const handleDelete = useCallback((id: string) => {
    dispatch({ type: "DELETE_BLOCK", payload: id });
  }, []);

  const handleBlockChange = useCallback((changes: Partial<WorkflowBlock>) => {
    if (state.selectedBlockId) {
      dispatch({ type: "UPDATE_BLOCK", payload: { id: state.selectedBlockId, changes } });
    }
  }, [state.selectedBlockId]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") dispatch({ type: "SELECT_BLOCK", payload: null });
      if ((e.key === "Delete" || e.key === "Backspace") && state.selectedBlockId) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
        e.preventDefault();
        dispatch({ type: "DELETE_BLOCK", payload: state.selectedBlockId });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.selectedBlockId]);

  return (
    <DndContext
      collisionDetection={rectIntersection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <EditorLayout
        metadataBar={
          <TaskMetadataBar
            metadata={state.metadata}
            onChange={(updates) => dispatch({ type: "SET_METADATA", payload: updates })}
            onSave={handleSave}
            onExport={() => setShowYaml(true)}
            saving={saving}
            isDirty={state.isDirty}
            isNew={isNew}
          />
        }
        palette={<BlockPalette onClickAction={handlePaletteClick} />}
        canvas={
          <WorkflowCanvas
            blocks={state.blocks}
            selectedBlockId={state.selectedBlockId}
            onSelect={handleSelect}
            onDelete={handleDelete}
          />
        }
        properties={<PropertyPanel block={selectedBlock} onChange={handleBlockChange} />}
      />
      <YamlPreviewModal
        open={showYaml}
        onClose={() => setShowYaml(false)}
        metadata={state.metadata}
        blocks={state.blocks}
      />
    </DndContext>
  );
}
