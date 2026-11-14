"use client";

import { X, Clock, User, Phone, MapPin, CheckCircle2, Pencil, Check, X as XIcon } from "lucide-react";
import type { Incident } from "@hub/shared/types/incident";
import { STATUS_BADGES } from "@/lib/styles";
import { formatDate, ESTADO_LABELS, formatTicketId } from "@/lib/utils";
import IncidentPhoto from "@/components/IncidentPhoto";
import { useState } from "react";
import { api } from "@/lib/api";

interface TicketDetailModalProps {
  incident: Incident | null;
  onClose: () => void;
}

export default function TicketDetailModal({ incident, onClose }: TicketDetailModalProps) {
  // 1. Todos los hooks PRIMERO (antes de cualquier return)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [saving, setSaving] = useState(false);

  // 2. Handlers
  const handleEdit = (comment: any) => {
    setEditingId(comment.id);
    setEditText(comment.texto);
  };

  const handleSave = async (commentId: string) => {
    if (!incident || !editText.trim()) return;
    setSaving(true);
    try {
      await api.patch(`/incidents/${incident.id}/comments/${commentId}`, {
        texto: editText.trim(),
      });
      const updated = await api.get<any>(`/incidents/${incident.id}`);
      Object.assign(incident, updated);
      setEditingId(null);
      setEditText("");
    } catch (err) {
      console.error("Error editando comentario", err);
      alert("No se pudo editar el comentario");
    } finally {
      setSaving(false);
    }
  };

  // 3. Ahora sí, el early return
  if (!incident) return null;

  // 4. Variables derivadas
  const status = ESTADO_LABELS[incident.estado] || incident.estado;
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
              <InfoBlock icon={User} label="Nombre del Solicitante" value={(incident as any).reportante_nombre || "No registrado"} />
              <InfoBlock icon={User} label="Cédula del Solicitante" value={(incident as any).reportante_cedula || "No registrado"} />
              
              {incident.nombre !== incident.punto_venta && (
                <InfoBlock icon={User} label="Usuario del Punto" value={incident.nombre} />
              )}
              <InfoBlock icon={User} label="Código del punto" value={incident.documento} />
              <InfoBlock icon={Phone} label="Teléfono" value={incident.telefono || "—"} />
              <InfoBlock icon={MapPin} label="Punto de Venta" value={incident.punto_venta} />
              <InfoBlock icon={Clock} label="Estado" value={status} />
              
              <div className="col-span-2">
                <InfoBlock icon={User} label="Técnico asignado" value={incident.agente || "Sin asignar"} />
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
            {incident.imagenes && incident.imagenes.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-400 font-inter uppercase tracking-[0.3px] mb-3">
                  Fotos adjuntas
                </p>
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {incident.imagenes.map((imgKey, index) => (
                    <IncidentPhoto
                      key={imgKey}
                      imageKey={imgKey}
                      alt={`Foto ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* SEGUIMIENTO / HISTORIAL */}
            {(incident as any).comments && (incident as any).comments.length > 0 && (
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-400 font-inter uppercase tracking-[0.3px] mb-3">
                  Historial de Seguimiento
                </p>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                  {(incident as any).comments.map((comment: any, index: number) => (
                    <div key={comment.id || index} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-6 h-6 rounded-full bg-[#F3F0FF] flex items-center justify-center shrink-0">
                          <User size={12} color="#25207E" />
                        </div>
                        {index !== (incident as any).comments.length - 1 && (
                          <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 my-1"></div>
                        )}
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 flex-1 border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{comment.autor}</span>
                            {(comment as any).edited_at && (
                              <span className="text-[9px] text-gray-400 italic">(editado)</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400 mr-1">{formatDate(comment.fecha)}</span>
                            {editingId !== comment.id && (
                              <button
                                onClick={() => handleEdit(comment)}
                                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                                title="Editar comentario"
                              >
                                <Pencil size={11} className="text-gray-500" />
                              </button>
                            )}
                          </div>
                        </div>

                        {editingId === comment.id ? (
                          <div className="mt-2">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="w-full p-2 text-sm rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-900 dark:text-white resize-none"
                              rows={3}
                              disabled={saving}
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <button
                                onClick={() => { setEditingId(null); setEditText(""); }}
                                disabled={saving}
                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 bg-gray-200 rounded disabled:opacity-50"
                              >
                                <XIcon size={12} /> Cancelar
                              </button>
                              <button
                                onClick={() => handleSave(comment.id)}
                                disabled={saving || !editText.trim()}
                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-[#25207E] rounded disabled:opacity-50"
                              >
                                <Check size={12} /> {saving ? "Guardando..." : "Guardar"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600 dark:text-gray-300">{comment.texto}</p>
                        )}
                      </div>
                    </div>
                  ))}
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