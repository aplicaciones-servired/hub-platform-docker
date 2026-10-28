"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { ApiUser } from "@hub/shared/types/user";
import { UserPlus } from "lucide-react";

interface CreateUserModalProps {
  onClose: () => void;
  onCreated: (user: ApiUser) => void;
}

export default function CreateUserModal({ onClose, onCreated }: CreateUserModalProps) {
  const [documento, setDocumento] = useState("");
  const [nombre, setNombre] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [rol, setRol] = useState("tecnico");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const created = await api.post<ApiUser>("/users", {
        documento,
        nombre,
        contrasena,
        rol,
      });
      onCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear usuario");
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
        <div className="flex items-center gap-2.5 mb-1.5">
          <UserPlus size={20} color="#25207E" strokeWidth={2.5} />
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 font-inter">
            Crear Usuario
          </h2>
        </div>
        <p className="text-[13px] text-gray-500 dark:text-gray-400 font-inter mb-6">
          El usuario podrá iniciar sesión en el APK con documento y contraseña.
        </p>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md px-3 py-2 mb-4 text-[13px] text-red-600 dark:text-red-400 font-inter">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 font-inter mb-1.5">
              Documento
            </label>
            <input
              type="text"
              value={documento}
              onChange={(e) => setDocumento(e.target.value)}
              maxLength={20}
              className="w-full h-11 px-3.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-[#F9FAFB] dark:bg-gray-800 text-sm font-inter text-gray-800 dark:text-gray-100 outline-none focus:border-[var(--brand)]"
              placeholder="123456789"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 font-inter mb-1.5">
              Nombre
            </label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={100}
              className="w-full h-11 px-3.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-[#F9FAFB] dark:bg-gray-800 text-sm font-inter text-gray-800 dark:text-gray-100 outline-none focus:border-[var(--brand)]"
              placeholder="Nombre completo"
              required
            />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 font-inter mb-1.5">
              Contraseña
            </label>
            <input
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              className="w-full h-11 px-3.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-[#F9FAFB] dark:bg-gray-800 text-sm font-inter text-gray-800 dark:text-gray-100 outline-none focus:border-[var(--brand)]"
              placeholder="Mínimo 8 caracteres"
              minLength={8}
              required
            />
          </div>

          <div className="mb-5">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 font-inter mb-1.5">
              Rol
            </label>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value)}
              className="w-full h-11 px-3.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-[#F9FAFB] dark:bg-gray-800 text-sm font-inter text-gray-800 dark:text-gray-100 outline-none cursor-pointer"
            >
              <option value="tecnico">Técnico</option>
              <option value="asesor">Asesor</option>
            </select>
          </div>

          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-[18px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 cursor-pointer text-[13px] font-medium font-inter text-gray-700 dark:text-gray-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="h-10 px-[18px] rounded-lg border-none font-inter text-[13px] font-semibold text-white bg-[#25207E] disabled:bg-[#25207E]/70 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? "Creando..." : "Crear Usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
