"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Save, X, RefreshCw, Cloud, Server, Database } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { useToast } from "@/contexts/ToastContext";
import Modal from "@/components/Modal";
import { useModal } from "@/hooks/useModal";
import { getCacheStats } from "@/lib/utils";
import SettingsEmpresaTab from "@/components/SettingsEmpresaTab";
import SettingsAparienciaTab from "@/components/SettingsAparienciaTab";
import SettingsMantenimientoTab from "@/components/SettingsMantenimientoTab";
import type { CompanySettings } from "@hub/shared/types/api";

const TABS = [
  { label: "Perfil de la Empresa", key: "empresa" },
  { label: "Apariencia", key: "apariencia" },
  { label: "Mantenimiento", key: "mantenimiento" },
] as const;

function SettingsTabBar({
  active,
  onChange,
}: {
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="border-b border-[#E5E7EB] dark:border-gray-700">
      <div className="flex gap-0">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={`relative px-5 py-3 text-[13px] font-inter transition-colors duration-150 ${
                isActive
                  ? "font-semibold text-[#25207E]"
                  : "font-normal text-[#6B7280] dark:text-gray-400"
              }`}
            >
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#25207E]" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const SETTINGS_KEY = "hub-platform-settings";

const defaultSettings: CompanySettings = {
  nombre: "Mi Empresa",
  contribuyente: "",
  direccion: "",
};

function loadSettings(): CompanySettings {
  if (typeof localStorage === "undefined") return defaultSettings;
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (!saved) return defaultSettings;
    const parsed = JSON.parse(saved);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.nombre === "string" &&
      typeof parsed.contribuyente === "string" &&
      typeof parsed.direccion === "string"
    ) {
      return parsed;
    }
    return defaultSettings;
  } catch {
    return defaultSettings;
  }
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("empresa");
  const { theme, setTheme } = useTheme();
  const cacheStats = getCacheStats();
  const [settings, setSettings] = useState<CompanySettings>(loadSettings);
  const [originalSettings, setOriginalSettings] = useState<CompanySettings>(loadSettings);
  const [saved, setSaved] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"local" | "saved" | "error">("local");
  const { modal, showAlert, showConfirm, closeModal } = useModal();
  const { showToast } = useToast();
  const userEditedRef = useRef(false);

  useEffect(() => {
    api.get<CompanySettings>("/settings").then((server) => {
      if (userEditedRef.current) return;
      if (server.nombre || server.contribuyente || server.direccion) {
        setSettings(server);
        setOriginalSettings(server);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(server));
        setSyncStatus("saved");
      }
    }).catch((err) => logger.error("Error fetching settings", { error: (err as Error).message }));
  }, []);

  const handleSettingsChange = useCallback((next: CompanySettings) => {
    userEditedRef.current = true;
    setSettings(next);
  }, []);

  const hasChanges =
    settings.nombre !== originalSettings.nombre ||
    settings.contribuyente !== originalSettings.contribuyente ||
    settings.direccion !== originalSettings.direccion;

  async function handleSave() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSyncing(true);
    try {
      await api.put("/settings", settings);
      setOriginalSettings({ ...settings });
      setSyncStatus("saved");
      showToast("Configuración guardada");
    } catch (err) {
      logger.error("Save settings error", { error: (err as Error).message });
      setSyncStatus("error");
    } finally {
      setSyncing(false);
    }
  }

  function handleDiscard() {
    setSettings({ ...originalSettings });
  }

  return (
    <div className="min-h-full bg-[#F7F8FC] dark:bg-gray-950 px-8 py-7">
      {/* Header */}
      <div className="mb-7">
        <h1 className="font-inter font-bold text-gray-900 dark:text-white text-[42px] leading-[1.1]">
          Configuración del Sistema
        </h1>
        <p className="text-[14px] text-[#6B7280] dark:text-gray-400 font-inter mt-2 max-w-[640px]">
          Administra la identidad de tu empresa, la seguridad y las preferencias
          globales de la plataforma.
        </p>
      </div>

      {/* Tabs */}
      <SettingsTabBar active={activeTab} onChange={setActiveTab} />

      {/* Tab Content - Empresa */}
      {activeTab === "empresa" && (
        <SettingsEmpresaTab
          settings={settings}
          onSettingsChange={handleSettingsChange}
        />
      )}

      {activeTab === "apariencia" && (
        <SettingsAparienciaTab theme={theme} onThemeChange={setTheme} />
      )}

      {activeTab === "mantenimiento" && (
        <SettingsMantenimientoTab
          cacheStats={cacheStats}
          showAlert={showAlert}
          showConfirm={showConfirm}
        />
      )}

      {/* Sync indicator */}
      {activeTab === "empresa" && (
        <div className="flex items-center gap-2 mt-4 mb-2">
          {syncing ? (
            <RefreshCw size={14} className="text-[#6B7280] animate-spin" />
          ) : syncStatus === "saved" ? (
            <Cloud size={14} className="text-green-500" />
          ) : syncStatus === "error" ? (
            <Server size={14} className="text-red-500" />
          ) : (
            <Database size={14} className="text-[#9CA3AF]" />
          )}
          <span className="text-[12px] font-inter text-[#6B7280]">
            {syncing ? "Sincronizando..." : syncStatus === "saved" ? "Guardado en servidor" : syncStatus === "error" ? "Error al sincronizar" : "Solo almacenamiento local"}
          </span>
        </div>
      )}

      {/* Action Buttons */}
      {activeTab === "empresa" && (
        <div className="flex justify-end gap-3 mt-2">
          <button
            onClick={handleDiscard}
            disabled={!hasChanges}
            className={`h-[44px] px-5 border rounded-lg text-[14px] font-medium font-inter flex items-center gap-2 transition-colors ${
              hasChanges
                ? "bg-white dark:bg-gray-900 border-[#D1D5DB] dark:border-gray-600 text-[#374151] dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                : "bg-white dark:bg-gray-900 border-[#D1D5DB] dark:border-gray-600 text-[#9CA3AF] dark:text-gray-500 cursor-not-allowed"
            }`}
          >
            <X size={16} />
            Descartar Cambios
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`h-[44px] px-5 rounded-lg text-[14px] font-medium font-inter flex items-center gap-2 transition-colors ${
              hasChanges
                ? "bg-[#25207E] text-white hover:bg-[#1e1b6b]"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            <Save size={16} />
            {saved ? "Guardado" : "Guardar Configuración"}
          </button>
        </div>
      )}

      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onConfirm={modal.onConfirm}
        confirmText={modal.confirmText}
        cancelText={modal.cancelText}
        showCancel={modal.showCancel}
      />
    </div>
  );
}
