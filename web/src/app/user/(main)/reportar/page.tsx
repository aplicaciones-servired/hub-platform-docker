"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { Send, MessageSquare } from "lucide-react";

export default function ReportarPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitError, setSubmitError] = useState("");
  const [hasHistory, setHasHistory] = useState(false);

  const [nombre, setNombre] = useState("");
  const [documento, setDocumento] = useState("");
  const [puntoVenta, setPuntoVenta] = useState("");
  const [telefono, setTelefono] = useState("");
  const [descripcion, setDescripcion] = useState("");

  useEffect(() => {
    if (user) {
      setNombre(user.nombre);
      setDocumento(user.documento);
      setPuntoVenta(user.nombre);
    }
    api.get<{ items: { telefono: string }[]; total: number }>("/incidents?limit=1")
      .then((data) => {
        if (data?.items?.length > 0 && data.items[0].telefono) {
          setTelefono(data.items[0].telefono);
          setHasHistory(true);
        } else if (data?.total && data.total > 0) {
          setHasHistory(true);
        }
      }).catch((err) => logger.error("Error fetching incident history", { error: err instanceof Error ? err.message : err }));
  }, [user]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!nombre.trim()) e.nombre = "El nombre no está disponible";
    if (!documento.trim()) e.documento = "El documento no está disponible";
    if (!puntoVenta.trim()) e.puntoVenta = "El punto de venta es requerido";
    if (!descripcion.trim()) e.descripcion = "La descripción es requerida";
    if (!hasHistory && !telefono.trim()) e.telefono = "El teléfono es requerido";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setSubmitError("");
    try {
      const incident = await api.post<{ id: string }>("/incidents", {
        nombre, documento, punto_venta: puntoVenta, telefono, descripcion,
      });
      router.push(`/user/exito?ticketId=${incident.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Error al enviar el reporte");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="bg-white border-b border-gray-200 px-5 py-4 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-[#EEEDF8] flex items-center justify-center">
          <span className="text-[#25207E] text-xs font-bold">H</span>
        </div>
        <span className="text-[22px] font-bold text-[#25207E]">CorpSupport</span>
      </div>

      <div className="flex flex-col items-center pt-6 px-4 pb-8">
        <div className="w-20 h-20 rounded-full bg-[#EEEDF8] flex items-center justify-center mb-4">
          <span className="text-[#25207E] text-3xl font-bold">H</span>
        </div>
        <h1 className="text-[34px] font-bold text-[#1F2366] text-center mb-2">Reportar un Incidente</h1>
        <p className="text-[15px] text-[#6B7280] text-center mb-6 max-w-[300px]">
          Por favor, completa los detalles para que nuestro equipo técnico pueda ayudarte.
        </p>

        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 w-[92%]">
            <p className="text-red-700 text-sm">{submitError}</p>
          </div>
        )}

        <div className="bg-white rounded-[18px] border border-[#E5E7EB] p-5 w-[92%] shadow-sm space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">Nombre Completo</label>
            <div className="flex items-center gap-2 h-[52px] rounded-input border border-input-border bg-gray-50 px-4">
              <span className="text-[15px] text-[#1F2937]">{nombre}</span>
            </div>
            {errors.nombre && <p className="text-xs text-red-500 mt-1">{errors.nombre}</p>}
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">CC / Documento</label>
            <div className="flex items-center gap-2 h-[52px] rounded-input border border-input-border bg-gray-50 px-4">
              <span className="text-[15px] text-[#1F2937]">{documento}</span>
            </div>
            {errors.documento && <p className="text-xs text-red-500 mt-1">{errors.documento}</p>}
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">Punto de Venta</label>
            <div className="flex items-center h-[52px] rounded-input border border-input-border bg-gray-50 px-4">
              <span className="text-[15px] text-[#1F2937]">{puntoVenta}</span>
            </div>
            {errors.puntoVenta && <p className="text-xs text-red-500 mt-1">{errors.puntoVenta}</p>}
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">Número de Teléfono</label>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => { setTelefono(e.target.value); if (errors.telefono) setErrors((p) => ({ ...p, telefono: undefined })); }}
              placeholder="Tu número de contacto"
              readOnly={hasHistory}
              className={`w-full h-[52px] rounded-input border bg-[#F9FAFB] px-4 text-[15px] text-[#1F2937] outline-none ${
                hasHistory ? "bg-gray-50 cursor-not-allowed" : ""
              } ${errors.telefono ? "border-red-500" : "border-input-border focus:border-[#25207E]"}`}
            />
            {errors.telefono && <p className="text-xs text-red-500 mt-1">{errors.telefono}</p>}
          </div>

          <div>
            <label className="block text-[13px] font-semibold text-[#374151] mb-1.5">Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => { setDescripcion(e.target.value); if (errors.descripcion) setErrors((p) => ({ ...p, descripcion: undefined })); }}
              placeholder="Describe qué sucedió..."
              rows={4}
              className={`w-full rounded-input border bg-[#F9FAFB] px-4 py-3 text-[15px] text-[#1F2937] outline-none resize-none ${
                errors.descripcion ? "border-red-500" : "border-input-border focus:border-[#25207E]"
              }`}
            />
            {errors.descripcion && <p className="text-xs text-red-500 mt-1">{errors.descripcion}</p>}
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full h-[52px] rounded-[10px] bg-[#2A237E] text-white font-semibold text-base flex items-center justify-center gap-2 disabled:opacity-70 hover:bg-[#1f1a63] transition-colors shadow-lg shadow-[#2A237E]/25"
          >
            <Send size={18} strokeWidth={2.5} />
            {loading ? "Enviando..." : "Enviar Reporte"}
          </button>
        </div>

        <button onClick={() => router.back()} className="flex items-center gap-2 mt-5 text-[#1F2366] text-sm">
          <MessageSquare size={18} strokeWidth={2} />
          Volver al chat
        </button>
      </div>

    </div>
  );
}
