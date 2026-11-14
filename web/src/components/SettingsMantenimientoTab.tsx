"use client";

import { Trash2, RefreshCw, Database, RotateCcw } from "lucide-react";

interface SettingsMantenimientoTabProps {
  cacheStats: { items: number; size: string; lsItems: number; ssItems: number };
  showAlert: (title: string, message: string, type: "info" | "success" | "warning" | "error") => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string, cancelText?: string) => void;
}

export default function SettingsMantenimientoTab({ cacheStats, showAlert, showConfirm }: SettingsMantenimientoTabProps) {
  function clearAppStorage() {
    const prefixes = ["api_cache_", "hub_", "theme", "settings", "sidebar", "dashboard:"];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && prefixes.some((p) => key.startsWith(p))) localStorage.removeItem(key);
    }
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key && prefixes.some((p) => key.startsWith(p))) sessionStorage.removeItem(key);
    }
  }

  const handleClearCache = () => {
    const size = cacheStats.size;
    const items = cacheStats.items;
    clearAppStorage();
    showAlert("Caché limpiado", `Caché local limpiado correctamente (${size}, ${items} ítems eliminados). Se recargará la página.`, "success");
    setTimeout(() => window.location.reload(), 1500);
  };

  const handleResetSettings = () => {
    showConfirm(
      "Restablecer Configuración",
      `¿Estás seguro de restablecer toda la configuración local? (${cacheStats.items} ítems, ${cacheStats.size})`,
      () => {
        const size = cacheStats.size;
        clearAppStorage();
        showAlert("Configuración restablecida", `Configuración restablecida (${size} eliminados). Se recargará la página.`, "success");
        setTimeout(() => window.location.reload(), 1500);
      }
    );
  };

  return (
    <div className="mt-7 flex gap-6">
      <div className="flex-[7] flex flex-col gap-6">
        {/* Clear App Cache */}
        <div className="bg-white dark:bg-gray-900 border border-[#E5E7EB] dark:border-gray-700 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#FEE2E2] flex items-center justify-center shrink-0">
              <Trash2 size={20} color="#DC2626" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <h3 className="text-[16px] font-bold text-[#1F2937] dark:text-gray-100 font-inter mb-1">
                Limpiar Caché Local
              </h3>
              <div className="flex gap-3 mb-4">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md">
                  <Database size={12} color="#6B7280" />
                  <span className="text-[12px] text-[#6B7280] dark:text-gray-400 font-inter font-medium">{cacheStats.lsItems} localStorage</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800 rounded-md">
                  <Database size={12} color="#6B7280" />
                  <span className="text-[12px] text-[#6B7280] dark:text-gray-400 font-inter font-medium">{cacheStats.ssItems} sessionStorage</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[#EEEDF8] rounded-md">
                  <Trash2 size={12} color="#25207E" />
                  <span className="text-[12px] text-[#25207E] font-inter font-semibold">{cacheStats.size}</span>
                </div>
              </div>
              <button
                onClick={handleClearCache}
                className="h-[38px] px-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-[13px] font-semibold text-red-600 dark:text-red-400 font-inter flex items-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
              >
                <Trash2 size={15} strokeWidth={2} />
                Limpiar caché
              </button>
            </div>
          </div>
        </div>

        {/* Recargar Datos */}
        <div className="bg-white dark:bg-gray-900 border border-[#E5E7EB] dark:border-gray-700 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#DBEAFE] flex items-center justify-center shrink-0">
              <RefreshCw size={20} color="#2563EB" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <h3 className="text-[16px] font-bold text-[#1F2937] dark:text-gray-100 font-inter mb-1">
                Recargar Datos
              </h3>
              <p className="text-[13px] text-[#6B7280] dark:text-gray-400 font-inter mb-4">
                Vuelve a cargar todos los datos desde el servidor sin limpiar la caché local.
                Útil cuando los datos no se actualizan correctamente.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="h-[38px] px-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-[13px] font-semibold text-blue-600 dark:text-blue-400 font-inter flex items-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
              >
                <RefreshCw size={15} strokeWidth={2} />
                Recargar página
              </button>
            </div>
          </div>
        </div>

        {/* Reset Settings */}
        <div className="bg-white dark:bg-gray-900 border border-[#E5E7EB] dark:border-gray-700 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#FEF3C7] flex items-center justify-center shrink-0">
              <RotateCcw size={20} color="#D97706" strokeWidth={2} />
            </div>
            <div className="flex-1">
              <h3 className="text-[16px] font-bold text-[#1F2937] dark:text-gray-100 font-inter mb-1">
                Restablecer Configuración
              </h3>
              <p className="text-[13px] text-[#6B7280] dark:text-gray-400 font-inter mb-4">
                Restaura todas las preferencias locales a sus valores por defecto.
                Solo afecta configuración del navegador, no datos del servidor.
              </p>
              <div className="mb-4 text-[12px] text-[#6B7280] dark:text-gray-400 font-inter bg-gray-50 dark:bg-gray-800 rounded-md px-3 py-2">
                Se eliminarán <strong>{cacheStats.items}</strong> ítems (<strong>{cacheStats.size}</strong>) de localStorage y sessionStorage.
              </div>
              <button
                onClick={handleResetSettings}
                className="h-[38px] px-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-[13px] font-semibold text-amber-600 dark:text-amber-400 font-inter flex items-center gap-2 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
              >
                <RotateCcw size={15} strokeWidth={2} />
                Restablecer todo
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-[3]">
        <div className="bg-white dark:bg-gray-900 border border-[#E5E7EB] dark:border-gray-700 rounded-xl p-6">
          <div className="w-10 h-10 rounded-lg bg-[#E9E6FF] flex items-center justify-center mb-4">
            <Database size={20} color="var(--brand)" strokeWidth={2} />
          </div>
          <h3 className="text-[15px] font-bold text-[#1F2937] dark:text-gray-100 font-inter mb-2">
            Información del Sistema
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-[13px] font-inter">
              <span className="text-[#6B7280] dark:text-gray-400">Navegador</span>
              <span className="text-[#1F2937] dark:text-gray-100 font-medium">
                {typeof window !== "undefined"
                  ? /Chrome/.test(navigator.userAgent) ? "Chrome" :
                    /Firefox/.test(navigator.userAgent) ? "Firefox" :
                    /Safari/.test(navigator.userAgent) ? "Safari" :
                    /Edg/.test(navigator.userAgent) ? "Edge" :
                    "Otro"
                  : "Servidor"}
              </span>
            </div>
            <div className="flex justify-between text-[13px] font-inter">
              <span className="text-[#6B7280] dark:text-gray-400">Almacenamiento</span>
              <span className="text-[#1F2937] dark:text-gray-100 font-medium">{cacheStats.size}</span>
            </div>
            <div className="flex justify-between text-[13px] font-inter">
              <span className="text-[#6B7280] dark:text-gray-400">Items en caché</span>
              <span className="text-[#1F2937] dark:text-gray-100 font-medium">{cacheStats.items}</span>
            </div>
            <div className="flex justify-between text-[13px] font-inter">
              <span className="text-[#6B7280] dark:text-gray-400">Versión</span>
              <span className="text-[#1F2937] dark:text-gray-100 font-medium">1.0.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
