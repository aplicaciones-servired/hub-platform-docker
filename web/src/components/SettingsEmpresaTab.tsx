"use client";

import Image from "next/image";
import { COMPANY_LOGO, COMPANY_NAME } from "@/lib/brand";
import type { CompanySettings } from "@hub/shared/types/api";

interface SettingsEmpresaTabProps {
  settings: CompanySettings;
  onSettingsChange: (settings: CompanySettings) => void;
}

export default function SettingsEmpresaTab({ settings, onSettingsChange }: SettingsEmpresaTabProps) {
  return (
    <div className="flex gap-6 mt-7">
      {/* Left column */}
      <div className="flex-[7]">
        {/* General Information Card */}
        <div className="bg-white dark:bg-gray-900 border border-[#E5E7EB] dark:border-gray-700 rounded-xl p-6">
          <h2 className="font-inter font-bold text-[#1F2937] dark:text-gray-100 mb-6 text-[30px] leading-[1.2]">
            Información General
          </h2>

          {/* Row 1 */}
          <div className="flex gap-5 mb-5">
            <div className="flex-1">
              <label className="block text-[14px] font-medium text-[#374151] dark:text-gray-300 font-inter mb-1.5">
                Nombre de la Empresa
              </label>
              <input
                type="text"
                value={settings.nombre}
                onChange={(e) => onSettingsChange({ ...settings, nombre: e.target.value })}
                className="w-full h-[42px] bg-[#F9FAFB] dark:bg-gray-800 border border-[#D1D5DB] dark:border-gray-600 rounded-md px-3 text-[14px] text-gray-900 dark:text-gray-100 font-inter outline-none focus:border-[var(--brand)] transition-colors"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[14px] font-medium text-[#374151] dark:text-gray-300 font-inter mb-1.5">
                ID de Contribuyente
              </label>
              <input
                type="text"
                value={settings.contribuyente}
                onChange={(e) => onSettingsChange({ ...settings, contribuyente: e.target.value })}
                className="w-full h-[42px] bg-[#F9FAFB] dark:bg-gray-800 border border-[#D1D5DB] dark:border-gray-600 rounded-md px-3 text-[14px] text-gray-900 dark:text-gray-100 font-inter outline-none focus:border-[var(--brand)] transition-colors"
              />
            </div>
          </div>

          {/* Row 2 */}
          <div>
            <label className="block text-[14px] font-medium text-[#374151] dark:text-gray-300 font-inter mb-1.5">
              Dirección Fiscal
            </label>
            <textarea
              value={settings.direccion}
              onChange={(e) => onSettingsChange({ ...settings, direccion: e.target.value })}
              rows={3}
              className="w-full h-[80px] bg-[#F9FAFB] dark:bg-gray-800 border border-[#D1D5DB] dark:border-gray-600 rounded-md px-3 py-2 text-[14px] text-[#1F2937] dark:text-gray-100 font-inter outline-none focus:border-[#25207E] transition-colors resize-none"
            />
          </div>
        </div>
      </div>

      {/* Right column */}
      <div className="flex-[3]">
        {/* Logo Card */}
        <div className="bg-white dark:bg-gray-900 border border-[#E5E7EB] dark:border-gray-700 rounded-xl p-6 flex flex-col items-center">
          <h2 className="font-inter font-bold text-[#1F2937] dark:text-gray-100 mb-6 self-start text-[30px] leading-[1.2]">
            Logo Corporativo
          </h2>
          <div className="w-full max-w-[260px] h-[100px] bg-[#F8FAFC] dark:bg-gray-800 border-2 border-dashed border-[#CBD5E1] dark:border-gray-600 rounded-xl flex items-center justify-center p-3">
            <Image
              src={COMPANY_LOGO}
              alt={`Logo de ${COMPANY_NAME}`}
              width={200}
              height={58}
              className="w-auto h-auto max-w-full object-contain"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
