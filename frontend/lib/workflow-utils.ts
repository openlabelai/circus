import { nanoid } from "nanoid";
import type { ActionType, Condition, WorkflowBlock, TaskMetadata } from "./workflow-types";
import { CONTROL_FLOW_ACTIONS } from "./workflow-types";

// --- ID generation ---

function makeId(): string {
  return nanoid(10);
}

// --- Convert backend actions → WorkflowBlocks ---

function conditionFromBackend(cond: Record<string, any>): Condition {
  if (cond.element_exists) {
    return { type: "element_exists", ...cond.element_exists };
  }
  if (cond.element_not_exists) {
    return { type: "element_not_exists", ...cond.element_not_exists };
  }
  if (cond.app_running) {
    return { type: "app_running", ...cond.app_running };
  }
  return { type: "element_exists" };
}

function conditionToBackend(cond: Condition): Record<string, any> {
  const { type, ...params } = cond;
  // Remove undefined values
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") clean[k] = v;
  }
  return { [type]: clean };
}

export function actionsToBlocks(actions: Record<string, any>[]): WorkflowBlock[] {
  return actions.map((a) => {
    const block: WorkflowBlock = {
      _id: makeId(),
      action: a.action as ActionType,
    };

    // Copy primitive fields
    const skip = new Set(["action", "condition", "then", "else", "actions", "on_error"]);
    for (const [k, v] of Object.entries(a)) {
      if (!skip.has(k) && v !== undefined) {
        (block as any)[k] = v;
      }
    }

    // Convert condition
    if (a.condition) {
      block.condition = conditionFromBackend(a.condition);
    }

    // Recursively convert nested action lists
    if (a.then) block.then = actionsToBlocks(a.then);
    if (a.else) block.else = actionsToBlocks(a.else);
    if (a.actions) block.actions = actionsToBlocks(a.actions);
    if (a.on_error) block.on_error = actionsToBlocks(a.on_error);

    return block;
  });
}

export function blocksToActions(blocks: WorkflowBlock[]): Record<string, any>[] {
  return blocks.map((block) => {
    const action: Record<string, any> = { action: block.action };

    // Copy primitive fields (skip internal and nested)
    const skip = new Set(["_id", "action", "condition", "then", "else", "actions", "on_error"]);
    for (const [k, v] of Object.entries(block)) {
      if (!skip.has(k) && v !== undefined && v !== "") {
        action[k] = v;
      }
    }

    // Convert condition back
    if (block.condition) {
      action.condition = conditionToBackend(block.condition);
    }

    // Recursively convert nested blocks
    if (block.then) action.then = blocksToActions(block.then);
    if (block.else) action.else = blocksToActions(block.else);
    if (block.actions) action.actions = blocksToActions(block.actions);
    if (block.on_error) action.on_error = blocksToActions(block.on_error);

    return action;
  });
}

// --- Create empty blocks ---

export function createEmptyBlock(actionType: ActionType): WorkflowBlock {
  const block: WorkflowBlock = { _id: makeId(), action: actionType };

  switch (actionType) {
    case "tap":
      block.text = "";
      break;
    case "long_press":
      block.duration = 1.0;
      break;
    case "swipe":
      block.direction = "up";
      break;
    case "type":
      block.text = "";
      break;
    case "press":
      block.key = "back";
      break;
    case "wait":
      block.text = "";
      block.timeout = 10;
      break;
    case "app_start":
      block.package = "";
      break;
    case "app_stop":
      block.package = "";
      break;
    case "sleep":
      block.duration = 1.0;
      break;
    case "if":
      block.condition = { type: "element_exists", text: "" };
      block.then = [];
      block.else = [];
      break;
    case "repeat":
      block.count = 3;
      block.actions = [];
      break;
    case "while":
      block.condition = { type: "element_exists", text: "" };
      block.actions = [];
      block.max_iterations = 100;
      break;
    case "try":
      block.actions = [];
      block.on_error = [];
      break;
  }

  return block;
}

// --- Recursive tree helpers ---

export function findAndUpdate(
  blocks: WorkflowBlock[],
  id: string,
  updater: (block: WorkflowBlock) => WorkflowBlock
): WorkflowBlock[] {
  return blocks.map((block) => {
    if (block._id === id) return updater(block);
    const updated = { ...block };
    if (updated.then) updated.then = findAndUpdate(updated.then, id, updater);
    if (updated.else) updated.else = findAndUpdate(updated.else, id, updater);
    if (updated.actions) updated.actions = findAndUpdate(updated.actions, id, updater);
    if (updated.on_error) updated.on_error = findAndUpdate(updated.on_error, id, updater);
    return updated;
  });
}

export function findAndRemove(blocks: WorkflowBlock[], id: string): WorkflowBlock[] {
  return blocks
    .filter((b) => b._id !== id)
    .map((block) => {
      const updated = { ...block };
      if (updated.then) updated.then = findAndRemove(updated.then, id);
      if (updated.else) updated.else = findAndRemove(updated.else, id);
      if (updated.actions) updated.actions = findAndRemove(updated.actions, id);
      if (updated.on_error) updated.on_error = findAndRemove(updated.on_error, id);
      return updated;
    });
}

export function findBlock(blocks: WorkflowBlock[], id: string): WorkflowBlock | null {
  for (const block of blocks) {
    if (block._id === id) return block;
    for (const key of ["then", "else", "actions", "on_error"] as const) {
      const children = block[key];
      if (children) {
        const found = findBlock(children, id);
        if (found) return found;
      }
    }
  }
  return null;
}

export function insertBlock(
  blocks: WorkflowBlock[],
  containerId: string,
  block: WorkflowBlock,
  index: number
): WorkflowBlock[] {
  // containerId is "root" for top-level, or "{parentId}:{field}" for nested
  if (containerId === "root") {
    const newBlocks = [...blocks];
    newBlocks.splice(index, 0, block);
    return newBlocks;
  }

  const [parentId, field] = containerId.split(":");
  return findAndUpdate(blocks, parentId, (parent) => {
    const list = [...((parent as any)[field] || [])];
    list.splice(index, 0, block);
    return { ...parent, [field]: list };
  });
}

export function removeFromContainer(
  blocks: WorkflowBlock[],
  containerId: string,
  blockId: string
): WorkflowBlock[] {
  if (containerId === "root") {
    return blocks.filter((b) => b._id !== blockId);
  }

  const [parentId, field] = containerId.split(":");
  return findAndUpdate(blocks, parentId, (parent) => {
    const list = ((parent as any)[field] || []).filter((b: WorkflowBlock) => b._id !== blockId);
    return { ...parent, [field]: list };
  });
}

// --- Block summary text for display ---

export function blockSummary(block: WorkflowBlock): string {
  switch (block.action) {
    case "tap":
      if (block.text) return `"${block.text}"`;
      if (block.resource_id) return block.resource_id;
      if (block.x !== undefined) return `(${block.x}, ${block.y})`;
      return "";
    case "long_press":
      if (block.text) return `"${block.text}" ${block.duration}s`;
      return `(${block.x}, ${block.y}) ${block.duration}s`;
    case "swipe":
      return block.direction || `(${block.sx},${block.sy})→(${block.ex},${block.ey})`;
    case "type":
      return block.text ? `"${block.text.substring(0, 30)}"` : "";
    case "press":
      return block.key || "";
    case "wait":
      return block.text ? `"${block.text}"` : block.resource_id || "";
    case "app_start":
    case "app_stop":
      return block.package || "";
    case "sleep":
      return `${block.duration}s`;
    case "screenshot":
      return "";
    case "if":
      return conditionSummary(block.condition);
    case "repeat":
      return `${block.count}×`;
    case "while":
      return conditionSummary(block.condition);
    case "try":
      return "";
    default:
      return "";
  }
}

function conditionSummary(cond?: Condition): string {
  if (!cond) return "";
  const label = cond.type.replace(/_/g, " ");
  const target = cond.text || cond.resource_id || cond.package || "";
  return target ? `${label}: "${target}"` : label;
}

// --- Default metadata ---

export function defaultMetadata(): TaskMetadata {
  return {
    name: "",
    description: "",
    target_package: "",
    timeout: 300,
    retry_count: 0,
  };
}

export function isControlFlow(action: ActionType): boolean {
  return CONTROL_FLOW_ACTIONS.includes(action);
}
