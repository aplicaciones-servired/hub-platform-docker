"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Trash2, LogOut, Database } from "lucide-react";
import { getCacheStats } from "@/lib/utils";
import { logger } from "@/lib/logger";
import Modal from "@/components/Modal";
import { useModal } from "@/hooks/useModal";

export default function AjustesPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [clearing, setClearing] = useState(false);
  const [cacheInfo, setCacheInfo] = useState({ items: 0, size: "0 KB" });
  const { modal, showConfirm, closeModal } = useModal();

  useEffect(() => {
    setCacheInfo(getCacheStats());
  }, []);


  async function handleClearCache() {
    showConfirm(
      "Limpiar Caché",
      "¿Estás seguro de querer eliminar el caché? Se cerrará tu sesión.",
      async () => {
        setClearing(true);
        try {
          await logout();
          if (typeof localStorage !== "undefined") localStorage.clear();
          window.location.href = "/user/login";
        } catch (err) {
          logger.error("Clear cache error", { error: (err as Error).message });
          setClearing(false);
        }
      }
    );
  }

  async function handleLogout() {
    showConfirm(
      "Cerrar Sesión",
      "¿Estás seguro de cerrar sesión?",
      async () => {
        try {
          await logout();
        } catch (err) {
          logger.error("Logout error", { error: (err as Error).message });
        }
        router.replace("/user/login");
      }
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F6FA] dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="h-[72px] flex items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#EEEDF8] dark:bg-gray-700 flex items-center justify-center">
              <span className="text-[#25207E] dark:text-gray-200 text-xs font-bold">H</span>
            </div>
            <span className="text-[22px] font-bold text-[#25207E] dark:text-gray-100">CorpSupport</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#DCD4FF] dark:bg-gray-700 flex items-center justify-center">
            <span className="text-[#25207E] dark:text-gray-200 text-sm font-bold">
              {user?.nombre?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 pt-6 pb-8 space-y-4">
        <div className="bg-white dark:bg-gray-800 border border-[#D9DCE8] dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <Trash2 size={18} color="#DC2626" strokeWidth={2} />
            </div>
            <h2 className="text-[15px] font-semibold text-[#1F2937] dark:text-gray-100">Limpiar Caché</h2>
          </div>
          <p className="text-[13px] text-[#6B7280] dark:text-gray-400 leading-relaxed mb-4">
            Elimina los datos almacenados localmente (tokens, sesión, archivos temporales). La app se recargará automáticamente.
          </p>
          <div className="flex gap-2 mb-4">
            <div className="flex-1 bg-[#F9FAFB] dark:bg-gray-700 rounded-lg p-2.5 text-center">
              <Database size={16} color="#6B7280" className="mx-auto" strokeWidth={2} />
              <p className="text-base font-bold text-[#1F2937] dark:text-gray-100 mt-1">{cacheInfo.items}</p>
              <p className="text-[11px] text-[#9CA3AF] dark:text-gray-400">ítems</p>
            </div>
            <div className="flex-1 bg-[#EEEDF8] dark:bg-gray-700 rounded-lg p-2.5 text-center">
              <Trash2 size={16} color="#25207E" className="mx-auto dark:text-gray-300" strokeWidth={2} />
              <p className="text-base font-bold text-[#25207E] dark:text-gray-100 mt-1">{cacheInfo.size}</p>
              <p className="text-[11px] text-[#9CA3AF] dark:text-gray-400">tamaño</p>
            </div>
          </div>
          <button
            onClick={handleClearCache}
            disabled={clearing}
            className="w-full h-11 rounded-lg bg-red-600 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:bg-red-300 hover:bg-red-700 transition-colors"
          >
            <Trash2 size={16} strokeWidth={2} />
            {clearing ? "Limpiando..." : "Limpiar Caché"}
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-[#D9DCE8] dark:border-gray-700 rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
              <LogOut size={18} color="#D97706" strokeWidth={2} />
            </div>
            <h2 className="text-[15px] font-semibold text-[#1F2937] dark:text-gray-100">Cerrar Sesión</h2>
          </div>
          <p className="text-[13px] text-[#6B7280] dark:text-gray-400 leading-relaxed mb-4">
            {user?.nombre ? `Sesión iniciada como ${user.nombre}` : "Sesión iniciada"}
          </p>
          <button
            onClick={handleLogout}
            className="w-full h-11 rounded-lg bg-amber-100 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-amber-200 dark:hover:bg-amber-900/30 transition-colors"
          >
            <LogOut size={16} strokeWidth={2} />
            Cerrar Sesión
          </button>
        </div>
      </div>

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
