"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical } from "lucide-react";
import type { ApiUser } from "@hub/shared/types/user";
import { ROLE_BADGES, ESTADO_BADGES } from "@/lib/styles";
import { getInitials, hasName, displayName } from "@/lib/utils";

function formatLastActivity(date: string | null): string {
  if (!date) return "Sin actividad";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Ahora";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours}h`;
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

interface UsersTableProps {
  users: ApiUser[];
  currentUserId: string;
  canManageUsers: boolean;
  onEdit: (user: ApiUser) => void;
  onToggleStatus: (user: ApiUser) => void;
  onResetPassword: (user: ApiUser) => void;
  onDelete: (user: ApiUser) => void;
}

function UserActionsMenu({ user, currentUserId, canManageUsers, onEdit, onToggleStatus, onResetPassword, onDelete }: { user: ApiUser; currentUserId: string; canManageUsers: boolean; onEdit: (u: ApiUser) => void; onToggleStatus: (u: ApiUser) => void; onResetPassword: (u: ApiUser) => void; onDelete: (u: ApiUser) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!canManageUsers || user.id === currentUserId) {
    return (
      <div className="flex justify-end py-3 px-2">
        <span className="text-[11px] text-gray-400 dark:text-gray-500 font-inter italic">
          {user.id === currentUserId ? "Tu cuenta" : "Solo administrador"}
        </span>
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
      >
        <MoreVertical size={16} color="#6B7280" strokeWidth={2} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-[999] py-1">
          <button
            onClick={() => { setOpen(false); onEdit(user); }}
            className="w-full text-left px-4 py-2 text-[13px] font-inter text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
          >
            Editar usuario
          </button>
          <button
            onClick={() => { setOpen(false); onResetPassword(user); }}
            className="w-full text-left px-4 py-2 text-[13px] font-inter text-orange-700 dark:text-orange-400 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
          >
            Resetear contraseña
          </button>
          {user.rol !== "admin" && (
            <button
              onClick={() => { setOpen(false); onToggleStatus(user); }}
              className={`w-full text-left px-4 py-2 text-[13px] font-inter cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 ${
                user.estado === "activo" ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"
              }`}
            >
              {user.estado === "activo" ? "Bloquear" : "Activar"}
            </button>
          )}
          {user.rol !== "admin" && (
            <button
              onClick={() => { setOpen(false); onDelete(user); }}
              className="w-full text-left px-4 py-2 text-[13px] font-inter text-red-700 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
            >
              Eliminar usuario
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function UsersTable({ users, currentUserId, canManageUsers, onEdit, onToggleStatus, onResetPassword, onDelete }: UsersTableProps) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-visible">
      <div className="grid grid-cols-[1fr_100px_110px_120px_120px_60px] bg-[#EEF2FF] dark:bg-gray-800 px-5">
        {["USUARIO", "ROL", "ESTADO", "BLOQUEADO POR", "ÚLTIMA ACTIVIDAD", "ACCIONES"].map((col) => (
          <div
            key={col}
            className="py-3.5 px-2 text-[11px] font-semibold text-gray-600 dark:text-gray-400 font-inter uppercase tracking-[0.5px]"
          >
            {col}
          </div>
        ))}
      </div>

      {!Array.isArray(users) ? null : users.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-gray-400 dark:text-gray-400 font-inter">No se encontraron usuarios</p>
        </div>
      )}
      {Array.isArray(users) && users.map((user) => (
        <div
          key={user.id}
          className="grid grid-cols-[1fr_100px_110px_120px_120px_60px] px-5 border-t border-gray-100 dark:border-gray-700 items-center"
        >
          <div className="flex items-center gap-3 py-3 px-2">
            <div className="w-9 h-9 rounded-full bg-[#F3F0FF] dark:bg-[rgba(129,140,248,0.15)] flex items-center justify-center text-[var(--brand)] text-[13px] font-semibold font-inter shrink-0">
              {getInitials(user)}
            </div>
            <div>
              <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 font-inter">
                {displayName(user)}
              </p>
              {hasName(user) && (
                <p className="text-[11px] text-gray-400 font-inter">
                  {user.documento}
                </p>
              )}
            </div>
          </div>

          <div className="py-3 px-2">
            <span
              className={`inline-block px-3 py-[3px] rounded-full text-[11px] font-semibold font-inter ${ROLE_BADGES[user.rol] || "bg-gray-200 text-gray-500"}`}
            >
              {user.rol.toUpperCase()}
            </span>
          </div>

          <div className="py-3 px-2">
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full shrink-0 ${ESTADO_BADGES[user.estado]?.dot || "bg-gray-400"}`}
              />
              <span
                className={`inline-block px-2 py-[2px] rounded-full text-[11px] font-medium font-inter ${ESTADO_BADGES[user.estado]?.bg || "bg-gray-100"} ${ESTADO_BADGES[user.estado]?.text || "text-gray-500"}`}
              >
                {user.estado === "activo" ? "Activo" : "Bloqueado"}
              </span>
            </div>
          </div>

          <div className="py-3 px-2">
            <span className="text-[13px] text-gray-500 dark:text-gray-400 font-inter">
              {user.estado === "bloqueado" && user.bloqueado_por_documento
                ? user.bloqueado_por_documento
                : "\u2014"}
            </span>
          </div>

          <div className="py-3 px-2">
            <span className="text-[13px] text-gray-500 dark:text-gray-400 font-inter">
              {formatLastActivity(user.ultima_actividad)}
            </span>
          </div>

          <div className="py-3 px-2 flex justify-end">
            <UserActionsMenu
              user={user}
              currentUserId={currentUserId}
              canManageUsers={canManageUsers}
              onEdit={onEdit}
              onToggleStatus={onToggleStatus}
              onResetPassword={onResetPassword}
              onDelete={onDelete}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
