"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import { Lock, Eye, EyeOff, LogIn, IdCard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import logoImg from "@/assets/logo.png";

export default function LoginPage() {
  const { login, loading } = useAuth();

  const [documento, setDocumento] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{
    documento?: string;
    contrasena?: string;
  }>({});
  const [loginError, setLoginError] = useState("");

  const validate = (): boolean => {
    const newErrors: { documento?: string; contrasena?: string } = {};

    if (!documento.trim()) {
      newErrors.documento = "El documento es requerido";
    }

    if (!contrasena.trim()) {
      newErrors.contrasena = "La contraseña es requerida";
    } else if (contrasena.length < 6) {
      newErrors.contrasena = "Mínimo 6 caracteres";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (!validate()) return;

    try {
      await login(documento, contrasena);
    } catch (err) {
      setLoginError(
        err instanceof Error ? err.message : "Credenciales inválidas"
      );
    }
  };

  return (
    <div className="bg-[#F5F4FC] dark:bg-gray-950 min-h-screen flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 w-[420px] rounded-xl border border-gray-200 dark:border-gray-700 shadow-[0_8px_24px_rgba(0,0,0,0.08)] p-9">
        <div className="flex justify-center mb-6">
          <Image
            src={logoImg}
            alt="Servired"
            width={220}
            height={64}
            priority
          />
        </div>

        <h1 className="font-inter text-[22px] font-bold text-gray-800 dark:text-gray-100 text-center">
          Bienvenido de nuevo
        </h1>

        <p className="font-inter text-sm font-normal text-gray-500 dark:text-gray-400 text-center mt-1.5 mb-[34px]">
          Accede a tu panel corporativo seguro.
        </p>

        <form onSubmit={handleSubmit}>
          {loginError && (
            <div className="bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4 text-[13px] text-red-600 font-inter">
              {loginError}
            </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 font-inter mb-1.5 ml-0.5">
              Número de Documento
            </label>
            <div
              className={`flex items-center h-12 w-full rounded-md bg-[#F8FAFC] dark:bg-gray-800 overflow-hidden ${
                errors.documento ? "border border-red-500" : "border border-[#D1D5DB]"
              }`}
            >
              <div className="flex items-center justify-center w-11 h-full shrink-0">
                <IdCard size={20} color="#9CA3AF" strokeWidth={1.75} />
              </div>
              <input
                type="text"
                value={documento}
                onChange={(e) => {
                  setDocumento(e.target.value);
                  if (errors.documento)
                    setErrors((prev) => ({ ...prev, documento: undefined }));
                }}
                placeholder="Ej: 123456789"
                autoComplete="off"
                autoCapitalize="off"
                className="flex-1 h-full border-none outline-none bg-transparent text-[15px] font-inter text-[#111827] dark:text-gray-100 pr-3"
              />
            </div>
            {errors.documento && (
              <p className="mt-1 ml-0.5 text-[11px] text-red-500 font-inter">
                {errors.documento}
              </p>
            )}
          </div>

          <div className="mb-6">
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 font-inter mb-1.5 ml-0.5">
              Contraseña
            </label>
            <div
              className={`flex items-center h-12 w-full rounded-md bg-[#F8FAFC] dark:bg-gray-800 overflow-hidden ${
                errors.contrasena ? "border border-red-500" : "border border-[#D1D5DB]"
              }`}
            >
              <div className="flex items-center justify-center w-11 h-full shrink-0">
                <Lock size={20} color="#9CA3AF" strokeWidth={1.75} />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                value={contrasena}
                onChange={(e) => {
                  setContrasena(e.target.value);
                  if (errors.contrasena)
                    setErrors((prev) => ({
                      ...prev,
                      contrasena: undefined,
                    }));
                }}
                placeholder="••••••••"
                autoComplete="current-password"
                className="flex-1 h-full border-none outline-none bg-transparent text-[15px] font-inter text-[#111827] dark:text-gray-100 pr-1"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                className="flex items-center justify-center w-11 h-full shrink-0 bg-none border-none cursor-pointer text-[#9CA3AF]"
              >
                {showPassword ? (
                  <EyeOff size={20} strokeWidth={1.75} />
                ) : (
                  <Eye size={20} strokeWidth={1.75} />
                )}
              </button>
            </div>
            {errors.contrasena && (
              <p className="mt-1 ml-0.5 text-[11px] text-red-500 font-inter">
                {errors.contrasena}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center w-full h-12 border-none rounded-md text-white text-[15px] font-semibold font-inter gap-2 shadow-[0_4px_12px_rgba(55,49,142,0.25)] bg-[#37318E] disabled:bg-[#37318E]/70 disabled:cursor-not-allowed disabled:opacity-70 cursor-pointer"
          >
            {loading ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                className="animate-spin"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  opacity="0.25"
                />
                <path
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  fill="currentColor"
                  opacity="0.75"
                />
              </svg>
            ) : (
              <>
                <span>Iniciar Sesión</span>
                <LogIn size={16} strokeWidth={2.5} />
              </>
            )}
          </button>
        </form>

        <div className="h-px bg-gray-200 dark:bg-gray-700 mt-6" />
      </div>
    </div>
  );
}
