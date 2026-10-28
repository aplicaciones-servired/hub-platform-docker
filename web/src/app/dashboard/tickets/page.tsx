"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { PlusCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import TicketSummaryCards from "@/components/TicketSummaryCards";
import TicketFilters from "@/components/TicketFilters";
import TicketTable from "@/components/TicketTable";
import TicketDetailModal from "@/components/TicketDetailModal";
import ResolveTicketModal from "@/components/ResolveTicketModal";
import CreateTicketModal from "@/components/CreateTicketModal";
import Pagination from "@/components/Pagination";
import Modal from "@/components/Modal";
import { useModal } from "@/hooks/useModal";
import { useToast } from "@/contexts/ToastContext";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { formatDateShort, formatDescription, getDateRange } from "@/lib/utils";
import type { Incident } from "@hub/shared/types/incident";

type IncidentItem = Incident;

export default function TicketsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const isTechnicianQueue = searchParams.get("view") === "technicians";
  const isAdmin = user?.rol === "admin";
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [technicians, setTechnicians] = useState<{ id: string; nombre: string; documento: string }[]>([]);
  const [techniciansLoading, setTechniciansLoading] = useState(false);
  const [techniciansError, setTechniciansError] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("Todos");
  const [dateFilter, setDateFilter] = useState("30d");
  const [selectedIncident, setSelectedIncident] = useState<IncidentItem | null>(null);
  const [resolvingTicket, setResolvingTicket] = useState<string | null>(null);
  const [stats, setStats] = useState({ pendientes: 0, enProceso: 0, resueltos: 0 });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { modal, showAlert, closeModal } = useModal();
  const { showToast } = useToast();

  const LIMIT = 10;

  // Búsqueda con debounce contra el servidor: al cambiar, vuelve a la página 1
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(searchTerm);
    }, 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Mark unread tickets as seen when viewing the page
  useEffect(() => {
    if (!isAdmin) return;
    api.patch("/incidents/mark-seen").catch((err) => logger.error("Error marking incidents as seen", { error: (err as Error).message }));
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      setTechnicians([]);
      return;
    }
    setTechniciansLoading(true);
    setTechniciansError(false);
    api.get<{ id: string; nombre: string; documento: string }[]>("/incidents/technicians")
      .then(setTechnicians)
      .catch((err) => {
        logger.error("Error fetching technicians", { error: err instanceof Error ? err.message : err });
        setTechniciansError(true);
      })
      .finally(() => setTechniciansLoading(false));
  }, [isAdmin]);

  const fetchTickets = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(LIMIT));
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (estadoFilter !== "Todos") params.set("estado", estadoFilter);

    const range = getDateRange(dateFilter);
    if (range.start) params.set("start", range.start);
    if (range.end) params.set("end", range.end);

    api
      .get<{ items: IncidentItem[]; total: number }>(
        `/incidents?${params.toString()}`
      )
      .then((data) => {
        setIncidents(data.items);
        setTotal(data.total);
      })
      .catch((err) =>
        logger.error("Error fetching tickets", { error: err instanceof Error ? err.message : err })
      )
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, estadoFilter, dateFilter]);

  const fetchStats = useCallback(() => {
    if (!isAdmin) {
      setStats({ pendientes: 0, enProceso: 0, resueltos: 0 });
      return;
    }
    const range = getDateRange(dateFilter);
    const params = new URLSearchParams();
    if (range.start) params.set("start", range.start);
    if (range.end) params.set("end", range.end);

    api
      .get<{ pendientes: number; enProceso: number; resueltos: number }>(
        `/dashboard/kpis?${params.toString()}`
      )
      .then((data) => {
        setStats({
          pendientes: data.pendientes,
          enProceso: data.enProceso,
          resueltos: data.resueltos,
        });
      })
      .catch((err) =>
        logger.error("Error fetching stats", { error: err instanceof Error ? err.message : err })
      );
  }, [dateFilter, isAdmin]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const handleStatusChange = useCallback(
    async (ticketId: string, newStatus: string) => {
      try {
        const updated = await api.patch<IncidentItem>(
          `/incidents/${ticketId}`,
          { estado: newStatus }
        );
        setIncidents((prev) =>
          (Array.isArray(prev) ? prev : []).map((inc) => (inc.id === ticketId ? updated : inc))
        );
        showToast("Estado actualizado correctamente");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        logger.error("Status change error", { error: msg });
        // El estado puede haber cambiado en el servidor (409): recargar la tabla
        fetchTickets();
        showAlert(
          "No se pudo cambiar el estado",
          msg || "Revisa el estado actual del ticket e intenta de nuevo.",
          "error"
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showAlert, fetchTickets, showToast, technicians]
  );

  const handleViewDetail = useCallback(
    async (ticketId: string) => {
      try {
        const incident = await api.get<IncidentItem>(
          `/incidents/${ticketId}`
        );
        setSelectedIncident(incident);
      } catch (err) {
        logger.error("Detail error", { error: err instanceof Error ? err.message : err });
        showAlert("Error", "No se pudo cargar el detalle del ticket.", "error");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showAlert]
  );

  const handleResolve = useCallback(
    (ticketId: string) => {
      setResolvingTicket(ticketId);
    },
    []
  );

  const handleResolved = useCallback(
    (ticketId: string) => {
      fetchTickets();
      fetchStats();
      showToast("Ticket resuelto");
    },
    [fetchTickets, fetchStats, showToast]
  );

  const handleAssignAgent = useCallback(
    async (ticketId: string, technicianId: string | null) => {
      try {
        const updated = await api.patch<IncidentItem>(
          `/incidents/${ticketId}`,
          { tecnico_id: technicianId }
        );
        setIncidents((prev) =>
          (Array.isArray(prev) ? prev : []).map((inc) => (inc.id === ticketId ? updated : inc))
        );
        const technicianName = technicians.find((technician) => technician.id === technicianId)?.nombre;
        showToast(technicianName ? `Ticket asignado a ${technicianName}` : "Asignación de técnico quitada");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        logger.error("Assign agent error", { error: msg });
        fetchTickets();
        showAlert(
          "No se pudo asignar el agente",
          msg || "El ticket puede haber cambiado. Se recargó la tabla.",
          "error"
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showAlert, fetchTickets, showToast]
  );

  const handleExport = useCallback(async () => {
    const range = getDateRange(dateFilter);
    const params = new URLSearchParams();
    if (range.start) params.set("start", range.start);
    if (range.end) params.set("end", range.end);
    const qs = params.toString() ? `?${params.toString()}` : "";

    let items: IncidentItem[] = [];
    try {
      const data = await api.get<{ items: IncidentItem[] }>(`/incidents/export-data${qs}`);
      items = data.items || [];
    } catch (err) {
      logger.error("Export incidents error", { error: (err as Error).message });
      return;
    }

    const fmtDate = (d: string) =>
      new Date(d).toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Tickets");

    ws.columns = [
      { header: "Documento", key: "doc", width: 16 },
      { header: "Nombre", key: "nombre", width: 22 },
      { header: "Teléfono", key: "tel", width: 14 },
      { header: "Punto de Venta", key: "pv", width: 22 },
      { header: "Urgencia", key: "urg", width: 12 },
      { header: "Estado", key: "est", width: 14 },
      { header: "Técnico", key: "tecnico", width: 20 },
      { header: "Descripción de la falla", key: "desc", width: 50 },
      { header: "Solución del problema", key: "sol", width: 50 },
      { header: "Creado", key: "creado", width: 20 },
      { header: "Actualizado", key: "act", width: 20 },
    ];

    const h = ws.getRow(1);
    h.font = { bold: true, color: { argb: "FFFFFFFF" } };
    h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF25207E" } };

    items.forEach((inc, i) => {
      const row = ws.getRow(2 + i);
      row.getCell(1).value = inc.documento;
      row.getCell(2).value = inc.nombre;
      row.getCell(3).value = inc.telefono;
      row.getCell(4).value = inc.punto_venta;
      row.getCell(5).value = inc.urgencia;
      row.getCell(6).value = inc.estado;
      row.getCell(7).value = inc.agente || "";
      row.getCell(8).value = inc.descripcion;
      row.getCell(9).value = inc.solucion || "";
      row.getCell(10).value = fmtDate(inc.created_at);
      row.getCell(11).value = fmtDate(inc.updated_at);
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tickets_hub${qs ? `_${range.start}_${range.end}` : ""}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exportación lista: ${items.length} tickets`);
  }, [dateFilter, showToast]);

  const mappedTickets = useMemo(
    () => {
      const safe = Array.isArray(incidents) ? incidents : [];
      return safe.map((inc) => ({
        id: inc.id,
        asunto: formatDescription(inc.descripcion),
        categoria: inc.punto_venta,
        solicitante: inc.nombre,
        estado:
          inc.estado === "pendiente"
            ? "Abierto"
            : inc.estado === "en_proceso"
              ? "En Proceso"
              : "Resuelto",
        createdAt: formatDateShort(inc.created_at),
        fechaCierre: inc.fecha_cierre ? formatDateShort(inc.fecha_cierre) : null,
        agente: inc.agente,
        tecnico_id: inc.tecnico_id,
      }));
    },
    [incidents]
  );

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="bg-[#F7F8FC] dark:bg-gray-950 min-h-[calc(100vh-72px)] p-8">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 className="text-[42px] font-bold text-gray-900 dark:text-white font-inter leading-tight">
            {isTechnicianQueue ? "Tickets técnicos" : "Gestión de Tickets"}
          </h1>
          <p className="mt-1.5 text-sm text-[#6B7280] dark:text-gray-400 font-inter max-w-[650px]">
            {isTechnicianQueue
              ? isAdmin
                ? "Consulte todos los tickets y revise el técnico asignado a cada uno."
                : "Consulta y gestiona los tickets que te han sido asignados."
              : "Administre las solicitudes de soporte, supervise el progreso del equipo y mantenga altos estándares de resolución para sus clientes externos e internos."}
          </p>
        </div>

        {isAdmin && <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 h-11 px-[18px] bg-[#25207E] border-none rounded-[10px] cursor-pointer font-inter text-[13px] font-semibold text-white"
        >
          <PlusCircle size={18} strokeWidth={2} />
          Abrir Nuevo Ticket
        </button>}
      </div>

      {/* Summary Cards */}
      {isAdmin && (
        <TicketSummaryCards
          total={total}
          pendientes={stats.pendientes}
          enProceso={stats.enProceso}
          resueltos={stats.resueltos}
          loading={loading}
        />
      )}

      {/* Filter Bar */}
      <TicketFilters
        searchTerm={searchTerm}
        estadoFilter={estadoFilter}
        dateFilter={dateFilter}
        onSearchChange={(v) => {
          setSearchTerm(v);
          setPage(1);
        }}
        onEstadoChange={(v) => {
          setEstadoFilter(v);
          setPage(1);
        }}
        onDateChange={setDateFilter}
        onExport={handleExport}
      />

      {/* Table */}
      <TicketTable
        tickets={mappedTickets}
        onStatusChange={handleStatusChange}
        onViewDetail={handleViewDetail}
        onAssignAgent={handleAssignAgent}
        onResolve={handleResolve}
        technicians={technicians}
        canAssign={isAdmin}
        techniciansLoading={techniciansLoading}
        techniciansError={techniciansError}
      />

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        from={(page - 1) * LIMIT + 1}
        to={Math.min(page * LIMIT, total)}
        itemLabel="tickets"
        onPageChange={setPage}
      />
      {selectedIncident && (
        <TicketDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
        />
      )}

      {resolvingTicket && (
        <ResolveTicketModal
          ticketId={resolvingTicket}
          ticketLabel={(() => {
            const match = mappedTickets.find((t) => t.id === resolvingTicket);
            return match ? `${match.asunto}` : resolvingTicket;
          })()}
          onClose={() => setResolvingTicket(null)}
          onResolved={handleResolved}
        />
      )}

      {showCreateModal && (
        <CreateTicketModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchTickets();
            fetchStats();
            showToast("Ticket creado correctamente");
          }}
          showAlert={showAlert}
        />
      )}

      <Modal
        isOpen={modal.isOpen}
        onClose={closeModal}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onConfirm={modal.onConfirm}
        confirmText={modal.confirmText}
        cancelText={modal.cancelText}
        showCancel={modal.showCancel}
      />
    </div>
  );
}
