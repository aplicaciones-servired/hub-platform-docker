"use client";

import { useState } from "react";
import { X, Eye, CheckCircle, Clock, Loader, UserPlus } from "lucide-react";
import { STATUS_ACTION_COLORS } from "@/lib/styles";
import { formatTicketId } from "@/lib/utils";

interface Technician {
  id: string;
  nombre: string;
  documento: string;
}

interface TicketRow {
  id: string;
  asunto: string;
  categoria: string;
  solicitante: string;
  estado: string;
  createdAt: string;
  fechaCierre: string | null;
  agente?: string | null;
  tecnico_id?: string | null;
  canChangeStatus?: boolean;
}

const STATUS_BADGES: Record<string, string> = {
  Abierto: "bg-blue-100 text-blue-600",
  "En Proceso": "bg-purple-100 text-purple-600",
  Resuelto: "bg-slate-100 text-slate-600",
};

interface TicketTableProps {
  tickets: TicketRow[];
  onStatusChange: (ticketId: string, newStatus: string) => void;
  onViewDetail: (ticketId: string) => void;
  onAssignAgent: (ticketId: string, technicianId: string | null) => void;
  onResolve?: (ticketId: string) => void;
  technicians?: Technician[];
  canAssign?: boolean;
  canChangeStatus?: boolean;
  techniciansLoading?: boolean;
  techniciansError?: boolean;
}

function ActionMenu({
  ticketId,
  currentStatus,
  currentAgente,
  currentTecnicoId,
  technicians,
  canAssign,
  canChangeStatus,
  techniciansLoading,
  techniciansError,
  onStatusChange,
  onViewDetail,
  onAssignAgent,
  onResolve,
}: {
  ticketId: string;
  currentStatus: string;
  currentAgente?: string | null;
  currentTecnicoId?: string | null;
  technicians: Technician[];
  canAssign: boolean;
  canChangeStatus: boolean;
  techniciansLoading: boolean;
  techniciansError: boolean;
  onStatusChange: (id: string, status: string) => void;
  onViewDetail: (id: string) => void;
  onAssignAgent: (id: string, technicianId: string | null) => void;
  onResolve?: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const statusOptions = [
    { label: "Pendiente", value: "pendiente", icon: Clock, color: STATUS_ACTION_COLORS.pendiente },
    { label: "En Proceso", value: "en_proceso", icon: Loader, color: STATUS_ACTION_COLORS.en_proceso },
    { label: "Resuelto", value: "resuelto", icon: CheckCircle, color: STATUS_ACTION_COLORS.resuelto },
  ];

  const safeStatus = currentStatus === "Abierto" ? "pendiente" : currentStatus === "En Proceso" ? "en_proceso" : "resuelto";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-8 px-3 rounded-lg bg-[#25207E] hover:bg-[#1f1a63] text-white text-xs font-semibold font-inter border-none cursor-pointer"
      >
        Acciones
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Acciones del ticket"
            className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Acciones del ticket</h2>
                {currentAgente && <p className="text-xs text-gray-500 mt-1">Técnico: {currentAgente}</p>}
              </div>
              <button onClick={() => setOpen(false)} aria-label="Cerrar" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <button
                onClick={() => {
                  onViewDetail(ticketId);
                  setOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                <Eye size={16} />
                Ver detalle
              </button>

              {canAssign && (
                <section>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                    <UserPlus size={16} />
                    Asignar a un técnico
                  </h3>
                  {techniciansError ? (
                    <p className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-600 dark:text-red-300">
                      No se pudo cargar la lista de técnicos. Cierra y vuelve a abrir las acciones.
                    </p>
                  ) : techniciansLoading ? (
                    <p className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-sm text-gray-500">
                      Cargando técnicos...
                    </p>
                  ) : technicians.length === 0 ? (
                    <p className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-sm text-gray-500">
                      No hay técnicos activos disponibles.
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                      {technicians.map((technician) => (
                        <button
                          key={technician.id}
                          onClick={() => {
                            onAssignAgent(ticketId, technician.id);
                            setOpen(false);
                          }}
                          className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-[#F3F0FF] dark:hover:bg-gray-800"
                        >
                          <span>
                            <span className="block text-sm font-medium text-gray-800 dark:text-gray-100">{technician.nombre}</span>
                            <span className="block text-xs text-gray-500">{technician.documento}</span>
                          </span>
                          {currentTecnicoId === technician.id && <span className="text-xs font-semibold text-[#25207E]">Asignado</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {currentTecnicoId && (
                    <button
                      onClick={() => {
                        onAssignAgent(ticketId, null);
                        setOpen(false);
                      }}
                      className="mt-2 text-xs font-medium text-red-600 hover:underline"
                    >
                      Quitar asignación
                    </button>
                  )}
                </section>
              )}

              {canChangeStatus && safeStatus !== "resuelto" && (
                <section>
                  <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">Cambiar estado</h3>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.filter((option) => option.value !== safeStatus).map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          if (option.value === "resuelto" && onResolve) onResolve(ticketId);
                          else onStatusChange(ticketId, option.value);
                          setOpen(false);
                        }}
                        className={`flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm ${option.color}`}
                      >
                        <option.icon size={14} />
                        {option.label}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function TicketTable({
  tickets,
  onStatusChange,
  onViewDetail,
  onAssignAgent,
  onResolve,
  technicians = [],
  canAssign = false,
  canChangeStatus = false,
  techniciansLoading = false,
  techniciansError = false,
}: TicketTableProps) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-visible">
      <div className="grid grid-cols-[90px_minmax(150px,1fr)_120px_110px_140px_100px_100px_90px] bg-[#EEF2FF] dark:bg-gray-800 px-5">
        {["ID TICKET", "ASUNTO", "SOLICITANTE", "ESTADO", "ASIGNADO A", "CREADO", "CIERRE", "ACCIONES"].map(
          (col) => (
            <div
              key={col}
              className="py-3.5 px-2 text-[11px] font-semibold text-gray-600 dark:text-gray-400 font-inter uppercase tracking-[0.5px]"
            >
              {col}
            </div>
          )
        )}
      </div>

      {tickets.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-gray-400 dark:text-gray-400 font-inter">No se encontraron tickets</p>
        </div>
      )}
      {(Array.isArray(tickets) ? tickets : []).map((ticket) => (
        <div
          key={ticket.id}
          className="grid grid-cols-[90px_minmax(150px,1fr)_120px_110px_140px_100px_100px_90px] px-5 border-t border-gray-100 dark:border-gray-700 items-center min-h-[56px]"
        >
          <div className="py-3 px-2">
            <span className="text-[13px] font-medium text-[var(--brand)] font-inter">
              {formatTicketId(ticket.id)}
            </span>
          </div>

          <div className="py-3 px-2">
            <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 font-inter">
              {ticket.asunto}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-400 font-inter mt-0.5">
              {ticket.categoria}
            </p>
          </div>

          <div className="py-3 px-2">
            <span className="text-[13px] text-gray-800 dark:text-gray-100 font-inter font-medium">
              {ticket.solicitante}
            </span>
          </div>

          <div className="py-3 px-2">
            <span
              className={`inline-block px-2.5 py-[3px] rounded-full text-[11px] font-semibold font-inter ${STATUS_BADGES[ticket.estado] || "bg-gray-100 text-gray-600"}`}
            >
              {ticket.estado}
            </span>
          </div>

          <div className="py-3 px-2">
            <span className="block truncate text-[12px] text-gray-700 dark:text-gray-300 font-inter" title={ticket.agente || "Sin asignar"}>
              {ticket.agente || "Sin asignar"}
            </span>
          </div>

          <div className="py-3 px-2">
            <span className="text-[12px] text-gray-500 dark:text-gray-400 font-inter">
              {ticket.createdAt}
            </span>
          </div>

          <div className="py-3 px-2">
            <span className="text-[12px] text-gray-500 dark:text-gray-400 font-inter">
              {ticket.fechaCierre || "—"}
            </span>
          </div>

          <div className="py-3 px-2 flex justify-center">
            <ActionMenu
              ticketId={ticket.id}
              currentStatus={ticket.estado}
              currentAgente={ticket.agente}
              currentTecnicoId={ticket.tecnico_id}
              technicians={technicians}
              canAssign={canAssign}
              canChangeStatus={ticket.canChangeStatus ?? canChangeStatus}
              techniciansLoading={techniciansLoading}
              techniciansError={techniciansError}
              onStatusChange={onStatusChange}
              onViewDetail={onViewDetail}
              onAssignAgent={onAssignAgent}
              onResolve={onResolve}
            />
          </div>
        </div>
      ))}
      </div>
  );
}
