"use client";

import { X, Clock, User, Phone, MapPin, AlertCircle, CheckCircle2 } from "lucide-react";
import type { Incident } from "@hub/shared/types/incident";
import { PRIORITY_BADGES, STATUS_BADGES } from "@/lib/styles";
import { formatDate, ESTADO_LABELS, formatTicketId } from "@/lib/utils";

interface TicketDetailModalProps {
  incident: Incident | null;
  onClose: () => void;
}

export default function TicketDetailModal({ incident, onClose }: TicketDetailModalProps) {
  if (!incident) return null;

  const status = ESTADO_LABELS[incident.estado] || incident.estado;
  const priorityBadge = PRIORITY_BADGES[incident.urgencia] || "bg-gray-500 text-white";
  const statusBadge = STATUS_BADGES[incident.estado] || "bg-gray-500 text-white";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/40 z-[100] overflow-y-auto"
    >
      <div className="flex min-h-full items-center justify-center p-6">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-[560px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] dark:shadow-gray-900/30"
      >
        {/* Header */}
        <div className="bg-[#F8F8FC] dark:bg-gray-950 px-6 py-5 border-b border-gray-200 dark:border-gray-700 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-base font-bold text-gray-900 dark:text-white font-inter">
                {formatTicketId(incident.id)}
              </span>
              <span
                className={`inline-block px-2.5 py-[3px] rounded-full text-[11px] font-semibold font-inter ${priorityBadge}`}
              >
                {incident.urgencia.toUpperCase()}
              </span>
              <span
                className={`inline-block px-2.5 py-[3px] rounded-full text-[11px] font-semibold font-inter ${statusBadge}`}
              >
                {status}
              </span>
            </div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 font-inter leading-snug">
              {incident.descripcion}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 cursor-pointer shrink-0 ml-4"
          >
            <X size={14} color="#6B7280" strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-6">
          {/* Información en cuadrícula */}
          <div className="grid grid-cols-2 gap-4">
            {/* Datos del Solicitante */}
            <InfoBlock icon={User} label="Nombre del Solicitante" value={(incident as any).reportante_nombre || "No registrado"} />
            <InfoBlock icon={User} label="Cédula del Solicitante" value={(incident as any).reportante_cedula || "No registrado"} />
            
            {/* Datos del Punto de Venta */}
            <InfoBlock icon={User} label="Usuario del Punto" value={incident.nombre} />
            <InfoBlock icon={User} label="Documento del Punto" value={incident.documento} />
            <InfoBlock icon={Phone} label="Teléfono" value={incident.telefono || "—"} />
            <InfoBlock icon={MapPin} label="Punto de Venta" value={incident.punto_venta} />
            <InfoBlock icon={AlertCircle} label="Urgencia" value={incident.urgencia.charAt(0).toUpperCase() + incident.urgencia.slice(1)} />
            <InfoBlock icon={Clock} label="Estado" value={status} />
            
            <div className="col-span-2">
              <InfoBlock icon={User} label="Agente Asignado" value={incident.agente || "Sin asignar"} />
            </div>
            {incident.estado === "resuelto" && (
              <>
                {incident.solucion && (
                  <div className="col-span-2">
                    <InfoBlock icon={CheckCircle2} label="Solución" value={incident.solucion} />
                  </div>
                )}
                <InfoBlock icon={User} label="Cerrado por" value={incident.cerrado_por_nombre || "—"} />
                <InfoBlock icon={Clock} label="Fecha de cierre" value={incident.fecha_cierre ? formatDate(incident.fecha_cierre) : "—"} />
              </>
            )}
          </div>

          {/* FOTOS ADJUNTAS */}
          {(incident as any).imagenes && (incident as any).imagenes.length > 0 && (
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-400 font-inter uppercase tracking-[0.3px] mb-3">
                Fotos adjuntas
              </p>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {(incident as any).imagenes.map((imgKey: string, index: number) => {
                  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
                  const imageUrl = `${apiUrl}/upload/incidente/${imgKey}`;
                  return (
                    <a key={index} href={imageUrl} target="_blank" rel="noopener noreferrer" className="shrink-0" title="Clic para abrir en tamaño completo">
                      <img src={imageUrl} alt={`Foto ${index + 1}`} className="w-32 h-32 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity cursor-pointer shadow-sm" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>

          

        {/* Footer */}
        <div className="bg-[#F8F8FC] dark:bg-gray-950 px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <span className="text-[11px] text-gray-400 dark:text-gray-400 font-inter">
            Creado: {formatDate(incident.created_at)}
          </span>
          <span className="text-[11px] text-gray-400 dark:text-gray-400 font-inter">
            Actualizado: {formatDate(incident.updated_at)}
          </span>
        </div>
      </div>
    </div>
  </div>
  );
}

function InfoBlock({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-[#F3F0FF] flex items-center justify-center shrink-0 mt-0.5">
        <Icon size={14} color="var(--brand)" strokeWidth={2} />
      </div>
      <div>
        <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-400 font-inter uppercase tracking-[0.3px]">
          {label}
        </p>
        <p className="text-[13px] font-medium text-gray-800 dark:text-gray-100 font-inter mt-0.5">
          {value}
        </p>
      </div>
    </div>
  );
}
