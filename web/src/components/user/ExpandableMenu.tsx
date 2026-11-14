"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface MenuOption {
  label: string;
  subItems?: { label: string }[];
}

const MENU_OPTIONS: MenuOption[] = [
  { label: "Estado de reporte" },
  {
    label: "Soporte técnico",
    subItems: [
      { label: "Reportar incidente" },
      { label: "Preguntas frecuentes" },
    ],
  },
];

interface ExpandableMenuProps {
  onSubmenuPress?: (label: string) => void;
  onMenuPress?: (label: string) => void;
}

export function ExpandableMenu({ onSubmenuPress, onMenuPress }: ExpandableMenuProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (label: string) => {
    const option = MENU_OPTIONS.find((o) => o.label === label);
    if (!option) return;
    setSelected(label);
    if (!option.subItems) {
      onMenuPress?.(label);
    }
  };

  const selectedOption = MENU_OPTIONS.find((o) => o.label === selected);

  return (
    <div className="mt-3">
      {selectedOption && (
        <div className="mb-1">
          <div className="bg-[#201A7A] rounded-lg h-11 flex items-center justify-center gap-2">
            <span className="text-white text-[15px] font-medium">{selectedOption.label}</span>
            {selectedOption.subItems && (
              <ChevronDown size={18} color="#FFFFFF" strokeWidth={2.5} />
            )}
          </div>
          {selectedOption.subItems && (
            <div className="flex flex-row mt-2.5">
              <div className="w-[3px] bg-[#D9D9E8] rounded-full mr-3.5" />
              <div className="flex-1 flex flex-col gap-1">
                {selectedOption.subItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => onSubmenuPress?.(item.label)}
                    className="bg-[#EEEDF8] border border-[#DCD4FF] rounded-lg h-10 text-[#201A7A] text-sm font-medium hover:bg-[#E8E4FF] transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {selected === null && MENU_OPTIONS.map((option, i) => (
        <button
          key={option.label}
          onClick={() => handleSelect(option.label)}
          className={`bg-[#201A7A] rounded-lg h-11 flex items-center justify-center w-full text-white text-[15px] font-medium hover:bg-[#16145e] transition-colors ${
            i > 0 ? "mt-2" : ""
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
