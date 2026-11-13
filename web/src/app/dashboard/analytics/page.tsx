"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ClipboardList, CheckCircle, Clock, Activity, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  TrafficChart,
  DonutChart,
  StatusBarChart,
  HorasPicoChart, // <-- NUEVO
  TecnicoPieChart, // <-- NUEVO
  type AreaDataPoint,
  type DonutDataPoint,
  type StatusBarDataPoint,
} from "@/components/AnalyticsCharts";
import AnalyticsMetrics from "@/components/AnalyticsMetrics";
import AnalyticsFilters, { type FilterPreset } from "@/components/AnalyticsFilters";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { formatDateRange, getDateRange } from "@/lib/utils";
import type { KpiResponse } from "@hub/shared/types/api";

function ChartSkeleton() {
  return (
    <div className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-xl" style={{ height: 280 }} />
  );
}

export default function AnalyticsPage() {
  const [filter, setFilter] = useState<FilterPreset>("30d");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const fetchIdRef = useRef(0);
  const [appliedRange, setAppliedRange] = useState<{ start: string; end: string } | null>(null);
  
  const [metrics, setMetrics] = useState<{ icon: LucideIcon; title: string; value: string; desc: string }[]>([]);
  const [areaData, setAreaData] = useState<AreaDataPoint[]>([]);
  const [donutData, setDonutData] = useState<DonutDataPoint[]>([]);
  const [statusData, setStatusData] = useState<StatusBarDataPoint[]>([]);
  
  // --- NUEVOS ESTADOS ---
  const [horasPicoData, setHorasPicoData] = useState<any[]>([]);
  const [momentosPicoData, setMomentosPicoData] = useState<any[]>([]);
  const [tecnicoData, setTecnicoData] = useState<any[]>([]);
  const [tiempoTecnicoData, setTiempoTecnicoData] = useState<any[]>([]);
  
  const [agentes, setAgentes] = useState<string[]>([]);
  const [selectedAgente, setSelectedAgente] = useState("");
  const [allPvNames, setAllPvNames] = useState<string[]>([]);
  const [chartsLoading, setChartsLoading] = useState(false);

  useEffect(() => {
    api.get<string[]>("/incidents/agentes")
      .then(setAgentes)
      .catch((err) => logger.error("Error fetching agentes", { error: (err as Error).message }));
    api.get<{ nombre: string }[]>("/puntos-venta")
      .then((list) => setAllPvNames(list.map((p) => p.nombre)))
      .catch((err) => logger.error("Error fetching puntos-venta", { error: (err as Error).message }));
  }, []);

  const fetchData = useCallback((start: string, end: string, agente?: string) => {
    const id = ++fetchIdRef.current;
    setChartsLoading(true);
    const params = new URLSearchParams({ start, end });
    if (agente) params.set("agente", agente);
    const qs = `?${params.toString()}`;

    Promise.allSettled([
      api.get<KpiResponse>(`/dashboard/kpis${qs}`),
      api.get<any>(`/incidents/stats${qs}`)
    ]).then(([kpiResult, statsResult]) => {
      if (id !== fetchIdRef.current) return;
      
      if (kpiResult.status === 'fulfilled') {
        const kpis = kpiResult.value;
        setMetrics([
          { icon: ClipboardList, title: "Incidentes Reportados", value: kpis.totalIncidentes.toLocaleString(), desc: "Total de incidentes registrados" },
          { icon: Clock, title: "Pendientes", value: kpis.pendientes.toLocaleString(), desc: "A la espera de asignación" },
          { icon: Activity, title: "En Proceso", value: kpis.enProceso.toLocaleString(), desc: "Siendo atendidos actualmente" },
          { icon: CheckCircle, title: "Resueltos", value: kpis.resueltos.toLocaleString(), desc: "Cerrados exitosamente" },
        ]);
      } else {
        logger.error("Analytics KPIs error", { error: kpiResult.reason instanceof Error ? kpiResult.reason.message : kpiResult.reason });
      }

      if (statsResult.status === 'fulfilled') {
        const stats = statsResult.value;
        
        setAreaData(
          (Array.isArray(stats.timeline) ? stats.timeline : []).map((d: any) => ({
            name: d.fecha,
            trafico: d.incidentes,
            conversiones: d.resueltos,
          }))
        );
        setDonutData(stats.distribution || []);
        
        if (stats.statusCounts) {
          setStatusData([{
            name: agente || "General",
            pendientes: stats.statusCounts.pendientes,
            enProceso: stats.statusCounts.enProceso,
            resueltos: stats.statusCounts.resueltos,
          }]);
        }

        // --- NUEVOS DATOS ---
        setHorasPicoData(stats.horasPico || []);
        setTecnicoData(stats.ticketsPorTecnico || []);
        setTiempoTecnicoData(stats.tiempoPorTecnico || []);
        setMomentosPicoData(stats.momentosPico || []);

      } else {
        logger.error("Analytics stats error", { error: statsResult.reason instanceof Error ? statsResult.reason.message : statsResult.reason });
      }
    }).finally(() => setChartsLoading(false));
  }, []);

  useEffect(() => {
    const range = getDateRange("30d");
    fetchData(range.start, range.end);
  }, [fetchData]);

  const handleFilterChange = useCallback((newFilter: FilterPreset) => {
    if (newFilter === "custom") {
      setFilter("custom");
      setShowDatePicker(true);
      if (!startDate) {
        const range = getDateRange("30d");
        setStartDate(range.start);
        setEndDate(range.end);
      }
    } else {
      setFilter(newFilter);
      setShowDatePicker(false);
      setAppliedRange(null);
      const range = getDateRange(newFilter);
      setStartDate(range.start);
      setEndDate(range.end);
      fetchData(range.start, range.end, selectedAgente);
    }
  }, [selectedAgente, startDate, fetchData]);

  const handleAgentChange = useCallback((agente: string) => {
    setSelectedAgente(agente);
    const range = filter === "custom" && appliedRange ? appliedRange : getDateRange(filter);
    fetchData(range.start, range.end, agente || undefined);
  }, [filter, appliedRange, fetchData]);

  const handleApplyRange = useCallback(() => {
    if (!startDate || !endDate) return;
    if (startDate > endDate) return;
    setAppliedRange({ start: startDate, end: endDate });
    setShowDatePicker(false);
    setFilter("custom");
    fetchData(startDate, endDate, selectedAgente || undefined);
  }, [startDate, endDate, selectedAgente, fetchData]);

  const handleCancelRange = useCallback(() => {
    const range = getDateRange("30d");
    setShowDatePicker(false);
    setFilter("30d");
    setAppliedRange(null);
    setStartDate(range.start);
    setEndDate(range.end);
    fetchData(range.start, range.end, selectedAgente);
  }, [selectedAgente, fetchData]);

  const filterLabels: Record<FilterPreset, string> = {
    today: "Hoy",
    week: "Esta semana",
    month: "Este mes",
    "30d": "Últimos 30 días",
    custom: "Rango personalizado",
  };

  const subtitle = appliedRange
    ? `Rango: ${formatDateRange(appliedRange.start, appliedRange.end)}`
    : `Resumen de soporte corporativo — ${filterLabels[filter]}.`;

  return (
    <div id="analytics-report" className="bg-[#F8F8FC] dark:bg-gray-950 min-h-[calc(100vh-72px)] p-8">
      <div className="flex items-start justify-between mb-7 flex-wrap gap-4">
        <div>
          <h1 className="text-[42px] font-bold text-gray-800 dark:text-gray-100 font-inter leading-tight">
            Panel de Analítica
          </h1>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400 font-inter">
            {subtitle}
          </p>
        </div>

        <div className="flex flex-col gap-3 items-end">
          <div className="flex items-center gap-3">
            {agentes.length > 0 && (
              <div className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-3 h-11">
                <User size={16} color="#6B7280" strokeWidth={2} />
                <select
                  value={selectedAgente}
                  onChange={(e) => handleAgentChange(e.target.value)}
                  className="h-full border-none bg-transparent text-[13px] font-medium text-gray-700 dark:text-gray-300 font-inter cursor-pointer outline-none min-w-[140px]"
                >
                  <option value="">Todos los técnicos</option>
                  {agentes.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            )}

            <AnalyticsFilters
              filter={filter}
              showDatePicker={showDatePicker}
              startDate={startDate}
              endDate={endDate}
              appliedRange={appliedRange}
              metrics={metrics}
              areaData={areaData}
              donutData={donutData}
              onFilterChange={handleFilterChange}
              onStartChange={setStartDate}
              onEndChange={setEndDate}
              onApplyRange={handleApplyRange}
              onCancelRange={handleCancelRange}
              selectedAgente={selectedAgente}
            />
          </div>
        </div>
      </div>

      <AnalyticsMetrics metrics={metrics} />

      {/* Charts Row 1 */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 font-inter">
                Incidentes vs. Resueltos
              </h3>
              <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400 font-inter">
                Evolución de tickets en el tiempo
              </p>
            </div>
            <div className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#25207E]" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-inter">Incidentes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#A1A1AA]" />
                <span className="text-xs text-gray-500 dark:text-gray-400 font-inter">Resueltos</span>
              </div>
            </div>
          </div>
          {chartsLoading ? <ChartSkeleton /> : <TrafficChart data={areaData} />}
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
          <div className="mb-5">
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 font-inter">
              Incidentes por Punto de Venta
            </h3>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400 font-inter">
              Distribución de tickets por sucursal
            </p>
          </div>
          {chartsLoading ? <ChartSkeleton /> : <DonutChart data={donutData} allPvNames={allPvNames} />}
        </div>
      </div>

      {/* Charts Row 2 (NUEVOS) */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
          <div className="mb-5">
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 font-inter">
              🕐 Horas Pico
            </h3>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400 font-inter">
              Franjas horarias con mayor cantidad de reportes
            </p>
          </div>
          {chartsLoading ? <ChartSkeleton /> : <HorasPicoChart data={horasPicoData} />}
                    {momentosPicoData.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
              <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 font-inter uppercase tracking-[0.3px] mb-3">
                🔥 Los momentos más concurridos
              </p>
              <div className="space-y-2">
                {momentosPicoData.map((m: any, i: number) => {
                  const fecha = new Date(m.fecha + "T12:00:00");
                  const fechaFormato = fecha.toLocaleDateString("es-CO", { 
                    weekday: "long", 
                    day: "2-digit", 
                    month: "short" 
                  });
                  return (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600 dark:text-gray-400 font-inter capitalize">
                        {fechaFormato} a las {m.horaFormato}
                      </span>
                      <span className="font-bold text-[#EF4444] font-inter">
                        {m.total} {m.total === 1 ? "ticket" : "tickets"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
          <div className="mb-5">
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 font-inter">
              👨‍🔧 Tickets por Técnico
            </h3>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400 font-inter">
              Carga de trabajo por agente
            </p>
          </div>
          {chartsLoading ? <ChartSkeleton /> : <TecnicoPieChart data={tecnicoData} />}
        </div>
      </div>

      {/* Tiempo de Resolución (NUEVO) */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-6">
        <div className="mb-5">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 font-inter">
            ⏱️ Tiempo Promedio de Resolución por Técnico
          </h3>
          <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400 font-inter">
            Cuánto se demora cada técnico en cerrar un caso
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#F8F8FC] dark:bg-gray-800">
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Técnico</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Tickets Resueltos</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">Tiempo Promedio</th>
              </tr>
            </thead>
            <tbody>
              {tiempoTecnicoData.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-4 text-gray-500">No hay datos en este período.</td>
                </tr>
              ) : (
                tiempoTecnicoData.map((t: any) => (
                  <tr key={t.agente} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="px-3 py-2 text-sm font-medium text-gray-800 dark:text-gray-100">{t.agente}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{t.totalResueltos}</td>
                    <td className="px-3 py-2 text-sm text-[#25207E] font-semibold">
                      {t.promedioHoras >= 1 ? `${t.promedioHoras} h` : `${Math.round(t.promedioHoras * 60)} min`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Bar Chart */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-6">
        <div className="mb-5">
          <h3 className="text-base font-bold text-gray-800 dark:text-gray-100 font-inter">
            Incidentes por Estado
          </h3>
          <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400 font-inter">
            {selectedAgente ? `Técnico: ${selectedAgente}` : "Todos los técnicos"} — Pendientes, en proceso y resueltos
          </p>
        </div>
        <div className="flex items-center gap-6 mb-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#3B82F6]" />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-inter">Pendientes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#7C3AED]" />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-inter">En Proceso</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-[#22C55E]" />
            <span className="text-xs text-gray-500 dark:text-gray-400 font-inter">Resueltos</span>
          </div>
        </div>
        {chartsLoading ? <ChartSkeleton /> : <StatusBarChart data={statusData} />}
      </div>
    </div>
  );
}