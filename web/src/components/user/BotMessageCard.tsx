"use client";

import { useState } from "react";
import { ExpandableMenu } from "./ExpandableMenu";

interface SuggestedAction {
  label: string;
  action: string;
}

function parseBold(text: string): { text: string; bold: boolean }[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return { text: p.slice(2, -2), bold: true };
    }
    return { text: p.replace(/\*/g, ""), bold: false };
  });
}

interface BotMessageCardProps {
  message: string;
  timestamp: string;
  suggestedActions?: SuggestedAction[];
  isResolvedNotification?: boolean;
  onSuggestedAction?: (action: string, label: string) => void;
  onSubmenuPress?: (label: string) => void;
  onMenuPress?: (label: string) => void;
}

export function BotMessageCard({
  message,
  timestamp,
  suggestedActions,
  isResolvedNotification,
  onSuggestedAction,
  onSubmenuPress,
  onMenuPress,
}: BotMessageCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="px-4 mb-3">
      <div className="bg-white rounded-2xl border border-gray-200 p-4 w-[90%] shadow-sm">
        <p className="text-[15px] text-[#333] leading-relaxed mb-1">
          {parseBold(message).map((seg, i) => (
            <span key={i} className={seg.bold ? "font-bold" : ""}>
              {seg.text}
            </span>
          ))}
        </p>

        {suggestedActions && suggestedActions.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {suggestedActions.map((item) => (
              <button
                key={item.action}
                onClick={() => onSuggestedAction?.(item.action, item.label)}
                className="bg-[#EEEDF8] border border-[#DCD4FF] rounded-lg h-11 flex items-center justify-center text-[#201A7A] text-sm font-medium hover:bg-[#E8E4FF] transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {isResolvedNotification && !showMenu && (!suggestedActions || suggestedActions.length === 0) && (
          <div className="mt-3">
            <button
              onClick={() => setShowMenu(true)}
              className="bg-[#EEEDF8] border border-[#DCD4FF] rounded-lg h-11 flex items-center justify-center text-[#201A7A] text-sm hover:bg-[#E8E4FF] transition-colors w-full"
            >
              Hacer otra petición
            </button>
          </div>
        )}

        {!isResolvedNotification && (!suggestedActions || suggestedActions.length === 0) && (
          <ExpandableMenu onSubmenuPress={onSubmenuPress} onMenuPress={onMenuPress} />
        )}
      </div>
      <p className="text-[11px] text-[#9CA3AF] ml-1 mt-1">{timestamp}</p>
    </div>
  );
}
