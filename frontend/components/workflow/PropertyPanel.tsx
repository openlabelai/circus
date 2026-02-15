"use client";

import type { WorkflowBlock } from "@/lib/workflow-types";
import { PALETTE_CATEGORIES } from "@/lib/workflow-types";
import ConditionEditor from "./ConditionEditor";

const inputClass =
  "w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500";
const selectClass =
  "w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:border-blue-500";

function getLabel(action: string): string {
  for (const cat of PALETTE_CATEGORIES) {
    for (const item of cat.items) {
      if (item.type === action) return `${item.icon} ${item.label}`;
    }
  }
  return action;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

interface Props {
  block: WorkflowBlock | null;
  onChange: (changes: Partial<WorkflowBlock>) => void;
}

export default function PropertyPanel({ block, onChange }: Props) {
  if (!block) {
    return (
      <div className="text-gray-500 text-sm text-center mt-20">
        <p>Select a block to edit its properties</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-200 mb-4">{getLabel(block.action)}</h3>
      <div className="space-y-1">
        {block.action === "tap" && <TapProps block={block} onChange={onChange} />}
        {block.action === "long_press" && <LongPressProps block={block} onChange={onChange} />}
        {block.action === "swipe" && <SwipeProps block={block} onChange={onChange} />}
        {block.action === "type" && <TypeProps block={block} onChange={onChange} />}
        {block.action === "press" && <PressProps block={block} onChange={onChange} />}
        {block.action === "wait" && <WaitProps block={block} onChange={onChange} />}
        {block.action === "app_start" && <AppStartProps block={block} onChange={onChange} />}
        {block.action === "app_stop" && <AppStopProps block={block} onChange={onChange} />}
        {block.action === "sleep" && <SleepProps block={block} onChange={onChange} />}
        {block.action === "screenshot" && <p className="text-xs text-gray-500">No configuration needed.</p>}
        {block.action === "if" && <IfProps block={block} onChange={onChange} />}
        {block.action === "repeat" && <RepeatProps block={block} onChange={onChange} />}
        {block.action === "while" && <WhileProps block={block} onChange={onChange} />}
        {block.action === "try" && <p className="text-xs text-gray-500">Drag actions into the Try and On Error sections.</p>}
      </div>
    </div>
  );
}

// --- Individual property forms ---

type SubProps = { block: WorkflowBlock; onChange: (c: Partial<WorkflowBlock>) => void };

function TapProps({ block, onChange }: SubProps) {
  const mode = block.text !== undefined && block.text !== "" ? "text"
    : block.resource_id !== undefined && block.resource_id !== "" ? "resource_id"
    : block.x !== undefined ? "coords" : "text";

  return (
    <>
      <Field label="Target Mode">
        <select className={selectClass} value={mode} onChange={(e) => {
          const m = e.target.value;
          if (m === "text") onChange({ text: "", resource_id: undefined, x: undefined, y: undefined });
          else if (m === "resource_id") onChange({ text: undefined, resource_id: "", x: undefined, y: undefined });
          else onChange({ text: undefined, resource_id: undefined, x: 0, y: 0 });
        }}>
          <option value="text">By Text</option>
          <option value="resource_id">By Resource ID</option>
          <option value="coords">By Coordinates</option>
        </select>
      </Field>
      {mode === "text" && (
        <Field label="Text">
          <input className={inputClass} value={block.text || ""} onChange={(e) => onChange({ text: e.target.value })} />
        </Field>
      )}
      {mode === "resource_id" && (
        <Field label="Resource ID">
          <input className={inputClass} value={block.resource_id || ""} onChange={(e) => onChange({ resource_id: e.target.value })} />
        </Field>
      )}
      {mode === "coords" && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="X">
            <input type="number" className={inputClass} value={block.x ?? 0} onChange={(e) => onChange({ x: Number(e.target.value) })} />
          </Field>
          <Field label="Y">
            <input type="number" className={inputClass} value={block.y ?? 0} onChange={(e) => onChange({ y: Number(e.target.value) })} />
          </Field>
        </div>
      )}
      <Field label="Timeout (s)">
        <input type="number" className={inputClass} value={block.timeout ?? 10} onChange={(e) => onChange({ timeout: Number(e.target.value) })} />
      </Field>
    </>
  );
}

function LongPressProps({ block, onChange }: SubProps) {
  return (
    <>
      <Field label="Text (or use coordinates)">
        <input className={inputClass} value={block.text || ""} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="X">
          <input type="number" className={inputClass} value={block.x ?? ""} onChange={(e) => onChange({ x: Number(e.target.value) })} />
        </Field>
        <Field label="Y">
          <input type="number" className={inputClass} value={block.y ?? ""} onChange={(e) => onChange({ y: Number(e.target.value) })} />
        </Field>
      </div>
      <Field label="Duration (s)">
        <input type="number" step="0.1" className={inputClass} value={block.duration ?? 1.0} onChange={(e) => onChange({ duration: Number(e.target.value) })} />
      </Field>
    </>
  );
}

function SwipeProps({ block, onChange }: SubProps) {
  const mode = block.direction ? "direction" : "coords";
  return (
    <>
      <Field label="Mode">
        <select className={selectClass} value={mode} onChange={(e) => {
          if (e.target.value === "direction") onChange({ direction: "up", sx: undefined, sy: undefined, ex: undefined, ey: undefined });
          else onChange({ direction: undefined, sx: 0, sy: 0, ex: 0, ey: 0 });
        }}>
          <option value="direction">Direction</option>
          <option value="coords">Custom Coordinates</option>
        </select>
      </Field>
      {mode === "direction" && (
        <Field label="Direction">
          <select className={selectClass} value={block.direction || "up"} onChange={(e) => onChange({ direction: e.target.value as any })}>
            <option value="up">Up</option>
            <option value="down">Down</option>
            <option value="left">Left</option>
            <option value="right">Right</option>
          </select>
        </Field>
      )}
      {mode === "coords" && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Start X"><input type="number" className={inputClass} value={block.sx ?? 0} onChange={(e) => onChange({ sx: Number(e.target.value) })} /></Field>
          <Field label="Start Y"><input type="number" className={inputClass} value={block.sy ?? 0} onChange={(e) => onChange({ sy: Number(e.target.value) })} /></Field>
          <Field label="End X"><input type="number" className={inputClass} value={block.ex ?? 0} onChange={(e) => onChange({ ex: Number(e.target.value) })} /></Field>
          <Field label="End Y"><input type="number" className={inputClass} value={block.ey ?? 0} onChange={(e) => onChange({ ey: Number(e.target.value) })} /></Field>
        </div>
      )}
    </>
  );
}

function TypeProps({ block, onChange }: SubProps) {
  const personaVars = [
    "{persona.credentials.instagram.username}",
    "{persona.credentials.instagram.password}",
    "{persona.credentials.tiktok.username}",
    "{persona.credentials.tiktok.password}",
    "{persona.name}",
    "{persona.email}",
    "{persona.bio}",
  ];

  return (
    <>
      <Field label="Text">
        <textarea
          rows={3}
          className={inputClass + " resize-y font-mono text-xs"}
          value={block.text || ""}
          onChange={(e) => onChange({ text: e.target.value })}
        />
      </Field>
      <div className="mb-3">
        <label className="block text-xs text-gray-400 mb-1">Insert Variable</label>
        <div className="flex flex-wrap gap-1">
          {personaVars.map((v) => (
            <button
              key={v}
              onClick={() => onChange({ text: (block.text || "") + v })}
              className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-400 font-mono"
            >
              {v.replace("{persona.", "").replace("}", "")}
            </button>
          ))}
        </div>
      </div>
      <Field label="Into Element (optional)">
        <input className={inputClass} placeholder="Field text label" value={block.into || ""} onChange={(e) => onChange({ into: e.target.value })} />
      </Field>
      <Field label="Match By">
        <select className={selectClass} value={block.into_by || "text"} onChange={(e) => onChange({ into_by: e.target.value })}>
          <option value="text">Text</option>
          <option value="resourceId">Resource ID</option>
        </select>
      </Field>
    </>
  );
}

function PressProps({ block, onChange }: SubProps) {
  return (
    <Field label="Key">
      <select className={selectClass} value={block.key || "back"} onChange={(e) => onChange({ key: e.target.value })}>
        <option value="back">Back</option>
        <option value="home">Home</option>
        <option value="enter">Enter</option>
        <option value="menu">Menu</option>
        <option value="search">Search</option>
        <option value="volume_up">Volume Up</option>
        <option value="volume_down">Volume Down</option>
      </select>
    </Field>
  );
}

function WaitProps({ block, onChange }: SubProps) {
  return (
    <>
      <Field label="Text">
        <input className={inputClass} value={block.text || ""} onChange={(e) => onChange({ text: e.target.value })} />
      </Field>
      <Field label="Resource ID (optional)">
        <input className={inputClass} value={block.resource_id || ""} onChange={(e) => onChange({ resource_id: e.target.value })} />
      </Field>
      <Field label="Timeout (s)">
        <input type="number" className={inputClass} value={block.timeout ?? 10} onChange={(e) => onChange({ timeout: Number(e.target.value) })} />
      </Field>
    </>
  );
}

function AppStartProps({ block, onChange }: SubProps) {
  return (
    <>
      <Field label="Package">
        <input className={inputClass} placeholder="com.instagram.android" value={block.package || ""} onChange={(e) => onChange({ package: e.target.value })} />
      </Field>
      <Field label="Activity (optional)">
        <input className={inputClass} placeholder=".MainActivity" value={block.activity || ""} onChange={(e) => onChange({ activity: e.target.value })} />
      </Field>
    </>
  );
}

function AppStopProps({ block, onChange }: SubProps) {
  return (
    <Field label="Package">
      <input className={inputClass} placeholder="com.instagram.android" value={block.package || ""} onChange={(e) => onChange({ package: e.target.value })} />
    </Field>
  );
}

function SleepProps({ block, onChange }: SubProps) {
  return (
    <Field label="Duration (s)">
      <input type="number" step="0.1" className={inputClass} value={block.duration ?? 1.0} onChange={(e) => onChange({ duration: Number(e.target.value) })} />
    </Field>
  );
}

function IfProps({ block, onChange }: SubProps) {
  return (
    <>
      <p className="text-xs text-gray-500 mb-2">Configure the condition. Drag actions into Then/Else sections in the canvas.</p>
      <ConditionEditor
        condition={block.condition || { type: "element_exists" }}
        onChange={(condition) => onChange({ condition })}
      />
    </>
  );
}

function RepeatProps({ block, onChange }: SubProps) {
  return (
    <Field label="Count">
      <input type="number" min="1" className={inputClass} value={block.count ?? 3} onChange={(e) => onChange({ count: Number(e.target.value) })} />
    </Field>
  );
}

function WhileProps({ block, onChange }: SubProps) {
  return (
    <>
      <ConditionEditor
        condition={block.condition || { type: "element_exists" }}
        onChange={(condition) => onChange({ condition })}
      />
      <Field label="Max Iterations">
        <input type="number" min="1" className={inputClass} value={block.max_iterations ?? 100} onChange={(e) => onChange({ max_iterations: Number(e.target.value) })} />
      </Field>
    </>
  );
}
