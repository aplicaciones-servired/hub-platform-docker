"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import type { ApiUser } from "@hub/shared/types/user";
import { ROLE_BADGES } from "@/lib/styles";
import { getInitials, hasName, displayName } from "@/lib/utils";

function getRelativeTime(dateStr: string, now: number): string {
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes}m`;
  if (hours < 24) return `Hace ${hours}h`;
  if (days < 30) return `Hace ${days}d`;
  return `Miembro desde hace ${Math.floor(days / 30)} meses`;
}

export default function UserManagement() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    api
      .get<{ items: ApiUser[] }>("/users?limit=200")
      .then((data) => {
        const items = Array.isArray(data) ? data : (data?.items ?? []);
        setUsers(items);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Error al cargar usuarios";
        logger.error("Error loading users", { error: msg });
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, []);

  const sortedUsers = [...users].sort((a, b) => {
    const dateA = new Date(a.ultima_actividad || a.created_at).getTime();
    const dateB = new Date(b.ultima_actividad || b.created_at).getTime();
    return dateB - dateA;
  }).slice(0, 5);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 sm:p-6">
      <div className="flex items-start justify-between mb-4 sm:mb-6">
        <div>
          <h3 className="m-0 text-base sm:text-lg font-bold text-gray-900 dark:text-gray-100 font-inter">
            Gestión de Usuarios
          </h3>
          <p className="m-0 mt-1 text-xs sm:text-[13px] text-gray-500 dark:text-gray-400 font-inter">
            Usuarios registrados en la plataforma
          </p>
        </div>
        <button
          onClick={() => router.push("/dashboard/users")}
          className="h-9 sm:h-10 px-3 sm:px-[18px] bg-[#25207E] border-none rounded-lg cursor-pointer text-xs sm:text-[13px] font-semibold font-inter text-white"
        >
          Ver todos
        </button>
      </div>

      {loading && (
        <div className="text-center py-8">
          <p className="text-[14px] text-gray-400 dark:text-gray-500 font-inter">
            Cargando usuarios...
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3 text-[13px] text-red-600 dark:text-red-400 font-inter">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="flex flex-col gap-3">
          {!Array.isArray(sortedUsers) || sortedUsers.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-gray-500 font-inter py-8">
              No hay usuarios registrados.
            </p>
          ) : (
            sortedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center p-3 sm:p-[14px_16px] border border-gray-100 dark:border-gray-700 rounded-xl gap-3 sm:gap-[14px]"
              >
                <div className="w-9 h-9 sm:w-[42px] sm:h-[42px] rounded-full bg-[#EEEDF8] dark:bg-[#EEEDF8]/10 flex items-center justify-center text-[#25207E] dark:text-[#25207E] text-sm sm:text-[15px] font-semibold font-inter shrink-0">
                  {getInitials(user)}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-[13px] sm:text-[14px] font-semibold text-gray-900 dark:text-gray-100 font-inter truncate">
                        {displayName(user)}
                      </span>
                      <span
                        className={`inline-block px-2 py-[2px] rounded-full text-[10px] font-semibold font-inter ${ROLE_BADGES[user.rol] || "bg-gray-100 text-gray-500"}`}
                      >
                      {user.rol.toUpperCase()}
                    </span>
                  </div>
                  <p className="m-0 text-[11px] sm:text-[12px] text-gray-500 dark:text-gray-400 font-inter">
                    {hasName(user) ? user.documento : "Sin nombre"}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      user.estado === "activo" ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <span className="text-[11px] sm:text-[12px] text-gray-400 dark:text-gray-500 font-inter whitespace-nowrap">
                    {getRelativeTime(user.ultima_actividad || user.created_at, Date.now())}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
