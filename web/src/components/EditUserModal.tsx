"use client";

import { useState } from "react";
import type { ApiUser } from "@hub/shared/types/user";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";

interface EditUserModalProps {
  user: ApiUser;
  onClose: () => void;
  onSaved: (updated: ApiUser) => void;
}

export default function EditUserModal({ user, onClose, onSaved }: EditUserModalProps) {
  const [editNombre, setEditNombre] = useState(user.nombre);
  const [editDocumento, setEditDocumento] = useState(user.documento);
  const [editRole, setEditRole] = useState<string>(user.rol);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.patch<ApiUser>(`/users/${user.id}`, {
        nombre: editNombre,
        documento: editDocumento,
        rol: editRole,
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      logger.error("Save user error", { error: err instanceof Error ? err.message : err });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-[rgba(0,0,0,0.4)] flex items-center justify-center z-[100]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-900 rounded-2xl p-7 w-[380px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-gray-900/30"
      >
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 font-inter mb-1.5">Editar Usuario</h2>
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 font-inter mb-1.5">Documento</label>
          <input
            type="text"
            value={editDocumento}
            onChange={(e) => setEditDocumento(e.target.value)}
            className="w-full h-11 px-3.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-[#F9FAFB] dark:bg-gray-800 text-sm font-inter text-gray-800 dark:text-gray-100 outline-none"
            placeholder="Documento"
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 font-inter mb-1.5">Nombre</label>
          <input
            type="text"
            value={editNombre}
            onChange={(e) => setEditNombre(e.target.value)}
            className="w-full h-11 px-3.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-[#F9FAFB] dark:bg-gray-800 text-sm font-inter text-gray-800 dark:text-gray-100 outline-none"
            placeholder="Nombre del usuario"
          />
        </div>

        <div className="mb-5">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 font-inter mb-1.5">Rol</label>
          <select
            value={editRole}
            onChange={(e) => setEditRole(e.target.value)}
            className="w-full h-11 px-3.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-[#F9FAFB] dark:bg-gray-800 text-sm font-inter text-gray-800 dark:text-gray-100 outline-none cursor-pointer"
          >
            <option value="tecnico">Técnico</option>
            <option value="asesor">Asesor</option>
            <option value="admin">Administrador</option>
            <option value="user">Usuario</option>
          </select>
        </div>

        <div className="flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="h-10 px-[18px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 cursor-pointer text-[13px] font-medium font-inter text-gray-700 dark:text-gray-300"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-10 px-[18px] rounded-lg border-none font-inter text-[13px] font-semibold text-white bg-[#25207E] disabled:bg-[#25207E]/70 disabled:cursor-not-allowed cursor-pointer"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
