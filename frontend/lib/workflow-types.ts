export type ActionType =
  | "tap" | "long_press" | "swipe" | "type" | "press"
  | "wait" | "app_start" | "app_stop" | "screenshot" | "sleep"
  | "if" | "repeat" | "while" | "try";

export type ConditionType = "element_exists" | "element_not_exists" | "app_running";

export interface Condition {
  type: ConditionType;
  text?: string;
  resource_id?: string;
  package?: string;
}

export interface WorkflowBlock {
  _id: string;
  action: ActionType;

  // Tap / long_press / wait
  x?: number;
  y?: number;
  text?: string;
  resource_id?: string;
  timeout?: number;
  duration?: number;

  // Swipe
  direction?: "up" | "down" | "left" | "right";
  sx?: number; sy?: number; ex?: number; ey?: number;

  // Type
  into?: string;
  into_by?: string;

  // Press
  key?: string;

  // App
  package?: string;
  activity?: string;

  // Control flow
  condition?: Condition;
  then?: WorkflowBlock[];
  else?: WorkflowBlock[];
  count?: number;
  actions?: WorkflowBlock[];
  max_iterations?: number;
  on_error?: WorkflowBlock[];
}

export interface TaskMetadata {
  name: string;
  description: string;
  target_package: string;
  timeout: number;
  retry_count: number;
}

export interface PaletteCategory {
  name: string;
  color: string;
  items: { type: ActionType; label: string; icon: string }[];
}

export const PALETTE_CATEGORIES: PaletteCategory[] = [
  {
    name: "Interaction",
    color: "blue",
    items: [
      { type: "tap", label: "Tap", icon: "👆" },
      { type: "long_press", label: "Long Press", icon: "👇" },
      { type: "swipe", label: "Swipe", icon: "👋" },
      { type: "type", label: "Type Text", icon: "⌨" },
    ],
  },
  {
    name: "Navigation",
    color: "green",
    items: [
      { type: "press", label: "Press Key", icon: "⏎" },
      { type: "app_start", label: "Open App", icon: "▶" },
      { type: "app_stop", label: "Close App", icon: "⏹" },
    ],
  },
  {
    name: "Control Flow",
    color: "purple",
    items: [
      { type: "if", label: "If / Else", icon: "◇" },
      { type: "repeat", label: "Repeat", icon: "↻" },
      { type: "while", label: "While", icon: "⟳" },
      { type: "try", label: "Try / Catch", icon: "⚡" },
    ],
  },
  {
    name: "Utility",
    color: "amber",
    items: [
      { type: "wait", label: "Wait For", icon: "⏳" },
      { type: "sleep", label: "Sleep", icon: "💤" },
      { type: "screenshot", label: "Screenshot", icon: "📸" },
    ],
  },
];

export const ACTION_COLORS: Record<ActionType, string> = {
  tap: "blue", long_press: "blue", swipe: "blue", type: "blue",
  press: "green", app_start: "green", app_stop: "green",
  if: "purple", repeat: "purple", while: "purple", try: "purple",
  wait: "amber", sleep: "amber", screenshot: "amber",
};

export const CONTROL_FLOW_ACTIONS: ActionType[] = ["if", "repeat", "while", "try"];
