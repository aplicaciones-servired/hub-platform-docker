"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { formatDate, ESTADO_LABELS, ESTADO_COLORS, formatTicketId } from "@/lib/utils";
import { URGENCIA_COLORS } from "@/lib/styles";
import { ArrowLeft, User, Phone, MapPin, AlertCircle, Clock, Shield, MessageSquare, XCircle } from "lucide-react";

interface IncidentDetail {
  id: string; nombre: string; documento: string; telefono: string;
  punto_venta: string; descripcion: string;
  urgencia: "baja" | "media" | "alta";
  estado: "pendiente" | "en_proceso" | "resuelto";
  agente: string | null; created_at: string; updated_at: string;
  comments: { id: string; autor: string; texto: string; fecha: string }[];
}


function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-[#EEEDF8] flex items-center justify-center">
        <Icon size={14} color="#25207E" strokeWidth={2} />
      </div>
      <div className="flex-1">
        <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase">{label}</p>
        <p className="text-sm font-medium text-[#1F2937] mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function IncidenteDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api.get<IncidentDetail>(`/incidents/${id}`)
      .then(setIncident)
      .catch((err) => setError(err instanceof Error ? err.message : "Error al cargar el incidente"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F5F5] flex items-center justify-center">
        <div className="w-6 h-6 border-[3px] border-gray-200 border-t-[#3B348B] rounded-full animate-spin" />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="min-h-screen bg-[#F5F5F5]">
        <div className="flex items-center px-5 py-4 border-b border-gray-200 bg-white">
          <button onClick={() => router.back()}><ArrowLeft size={22} color="#1F2366" strokeWidth={2} /></button>
          <h1 className="text-lg font-bold text-[#1F2366] ml-4">{error ? "Error" : "Incidente no encontrado"}</h1>
        </div>
        {error && (
          <div className="flex flex-col items-center justify-center px-8 pt-20">
            <XCircle size={48} color="#EF4444" strokeWidth={1.5} />
            <p className="text-base text-[#EF4444] text-center mt-4 leading-relaxed">{error}</p>
            <button onClick={() => router.back()} className="mt-6 px-6 py-3 bg-[#3B348B] rounded-lg text-white font-semibold">Volver</button>
          </div>
        )}
      </div>
    );
  }

  const status = ESTADO_LABELS[incident.estado];
  const statusColor = ESTADO_COLORS[incident.estado];
  const urgencyColor = URGENCIA_COLORS[incident.urgencia];

  return (
    <div className="min-h-screen bg-[#F5F5F5]">
      <div className="bg-white border-b border-gray-200">
        <div className="flex items-center px-5 py-4">
          <button onClick={() => router.back()}><ArrowLeft size={22} color="#1F2366" strokeWidth={2} /></button>
          <h1 className="text-lg font-bold text-[#1F2366] ml-4">Detalle del Ticket</h1>
        </div>
      </div>

      <div className="p-4 space-y-3 pb-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2.5 mb-3 flex-wrap">
            <span className="text-lg font-bold text-[#25207E]">{formatTicketId(incident.id)}</span>
            <span className="text-[11px] font-bold text-white px-2.5 py-1 rounded-full" style={{ backgroundColor: urgencyColor }}>
              {incident.urgencia.toUpperCase()}
            </span>
            <span className="text-[11px] font-bold text-white px-2.5 py-1 rounded-full" style={{ backgroundColor: statusColor }}>
              {status}
            </span>
          </div>
          <p className="text-base text-[#1F2937] leading-relaxed">{incident.descripcion}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
          <InfoRow icon={User} label="Solicitante" value={incident.nombre} />
          <InfoRow icon={User} label="Documento" value={incident.documento} />
          <InfoRow icon={Phone} label="Teléfono" value={incident.telefono || "—"} />
          <InfoRow icon={MapPin} label="Punto de Venta" value={incident.punto_venta} />
          <InfoRow icon={AlertCircle} label="Urgencia" value={incident.urgencia.charAt(0).toUpperCase() + incident.urgencia.slice(1)} />
          <InfoRow icon={Clock} label="Estado" value={status} />
          <InfoRow icon={Shield} label="Técnico" value={incident.agente || "Sin asignar"} />
        </div>

        {incident.comments.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="text-base font-bold text-[#1F2937] mb-3">Comentarios</h2>
            {incident.comments.map((comment) => (
              <div key={comment.id} className="border-b border-gray-100 pb-3 mb-3 last:border-0 last:mb-0 last:pb-0">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare size={14} color="#6B7280" />
                  <span className="text-[13px] font-semibold text-[#374151]">{comment.autor}</span>
                  <span className="text-[11px] text-[#9CA3AF]">{formatDate(comment.fecha)}</span>
                </div>
                <p className="text-sm text-[#6B7280] ml-6">{comment.texto}</p>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex justify-between">
            <span className="text-xs text-[#9CA3AF]">Creado: {formatDate(incident.created_at)}</span>
            <span className="text-xs text-[#9CA3AF]">Actualizado: {formatDate(incident.updated_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
