"use client";

import { PALETTE_CATEGORIES, type ActionType } from "@/lib/workflow-types";

function PaletteItem({
  label, icon, color, onClick,
}: {
  label: string; icon: string; color: string; onClick: () => void;
}) {
  const colorMap: Record<string, string> = {
    blue: "border-blue-500/40 hover:border-blue-500 hover:bg-blue-500/10",
    green: "border-green-500/40 hover:border-green-500 hover:bg-green-500/10",
    purple: "border-purple-500/40 hover:border-purple-500 hover:bg-purple-500/10",
    amber: "border-amber-500/40 hover:border-amber-500 hover:bg-amber-500/10",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded border text-xs cursor-pointer select-none
        bg-gray-800/60 text-gray-300 transition-colors ${colorMap[color] || "border-gray-700"}`}
    >
      <span className="text-sm">{icon}</span>
      <span>{label}</span>
      <span className="ml-auto text-gray-600 text-[10px]">+</span>
    </button>
  );
}

interface Props {
  onClickAction: (type: ActionType) => void;
}

export default function BlockPalette({ onClickAction }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</h3>
      <p className="text-[10px] text-gray-600">Click to add to workflow</p>
      {PALETTE_CATEGORIES.map((cat) => (
        <div key={cat.name}>
          <h4 className="text-[10px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">{cat.name}</h4>
          <div className="space-y-1">
            {cat.items.map((item) => (
              <PaletteItem
                key={item.type}
                label={item.label}
                icon={item.icon}
                color={cat.color}
                onClick={() => onClickAction(item.type)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
