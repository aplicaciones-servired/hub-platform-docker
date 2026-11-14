"use client";

import { memo, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import DateRangePicker from "./DateRangePicker";
import type { AreaDataPoint, DonutDataPoint } from "./AnalyticsCharts";
import type { Incident } from "@hub/shared/types/incident";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { formatDateRange, getDateRange } from "@/lib/utils";

type IncidentExport = Incident;

export type FilterPreset = "today" | "week" | "month" | "30d" | "custom";

interface AnalyticsFiltersProps {
  filter: FilterPreset;
  showDatePicker: boolean;
  startDate: string;
  endDate: string;
  appliedRange: { start: string; end: string } | null;
  metrics: { title: string; value: string; desc: string }[];
  areaData: AreaDataPoint[];
  donutData: DonutDataPoint[];
  onFilterChange: (filter: FilterPreset) => void;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
  onApplyRange: () => void;
  onCancelRange: () => void;
  selectedAgente?: string;
}
// ─────────────────────────────────────────────────────────────
// Helpers de formato
// ─────────────────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDuracion(minutos: number): string {
  if (minutos < 1) return "< 1 min";
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

function colorTiempo(minutos: number | null): string {
  if (minutos === null) return "FF9CA3AF";
  if (minutos < 30) return "FF16A34A";
  if (minutos < 120) return "FFB45309";
  return "FFDC2626";
}

// ─────────────────────────────────────────────────────────────
// Estilos reutilizables
// ─────────────────────────────────────────────────────────────

const AZUL = "FF25207E";
const BLUE = "FF03A9F3";
const GREEN = "FF16A34A";
const DARK = "FF262626";
const GRAY = "FF7F7F7F";
const LIGHT_AZUL = "FFEEEDF8";
const LIGHT_BLUE = "FFEAF8FF";
const ZEBRA = "FFF9FAFB";
const BORDER = "FFD9D9D9";

function headerStyle(fill: string = AZUL) {
  return {
    font: { bold: true, color: { argb: "FFFFFFFF" }, size: 10, name: "Calibri" },
    fill: { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: fill } },
    alignment: { horizontal: "center" as const, vertical: "middle" as const, wrapText: true },
    border: {
      top: { style: "thin" as const, color: { argb: BORDER } },
      bottom: { style: "thin" as const, color: { argb: BORDER } },
      left: { style: "thin" as const, color: { argb: BORDER } },
      right: { style: "thin" as const, color: { argb: BORDER } },
    },
  };
}

const cellBorder = {
  border: {
    top: { style: "thin" as const, color: { argb: BORDER } },
    bottom: { style: "thin" as const, color: { argb: BORDER } },
    left: { style: "thin" as const, color: { argb: BORDER } },
    right: { style: "thin" as const, color: { argb: BORDER } },
  },
};

const zebraFill = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: ZEBRA },
};

// ─────────────────────────────────────────────────────────────
// EXPORTAR EXCEL
// ─────────────────────────────────────────────────────────────

async function handleExport(
  metrics: AnalyticsFiltersProps["metrics"],
  areaData: AreaDataPoint[],
  donutData: DonutDataPoint[],
  appliedRange: { start: string; end: string } | null,
  filter: FilterPreset,
  selectedAgente?: string
) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "HUB Platform";
  wb.created = new Date();

  const baseDate = new Date();
  const generatedAt = baseDate.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const effectiveRange = appliedRange || getDateRange(filter);
  const filtroLabel = selectedAgente ? `  ·  FILTRO APLICADO: Técnico — ${selectedAgente} (solo sus tickets)` : "";
  const rangeLabel = `Rango: ${formatDateRange(effectiveRange.start, effectiveRange.end)}  ·  Generado: ${generatedAt}${filtroLabel}`;
  const rangeSuffix = `_${effectiveRange.start}_${effectiveRange.end}`;

  // ── Fetch datos ──
  let incidents: IncidentExport[] = [];
  try {
    const qs = `?start=${effectiveRange.start}&end=${effectiveRange.end}`;
    const incData = await api.get<{ items: IncidentExport[] }>(`/incidents/export-data${qs}`);
    incidents = incData.items || [];
        if (selectedAgente) incidents = incidents.filter((inc) => inc.agente === selectedAgente);
  } catch (err) {
    logger.warn("Export incidents fetch failed", { error: (err as Error).message });
  }

  const totalIncidents = incidents.length;

  // ── Cálculos previos ──
  const tiemposGlobales: number[] = [];
  const agMap = new Map<string, { p: number; ep: number; r: number; tiempos: number[] }>();
  const pvMap = new Map<string, { count: number; tiempos: number[] }>();
  const estadoMap = { pendiente: 0, en_proceso: 0, resuelto: 0 };
  const dayOfWeek = [0, 0, 0, 0, 0, 0, 0];
  const hourBand = { madrugada: 0, manana: 0, tarde: 0, noche: 0 };
  const timeBuckets = { lt1h: 0, h1_6: 0, h6_24: 0, d1_3: 0, gt3d: 0 };

  for (const inc of incidents) {
    if (inc.estado === "pendiente") estadoMap.pendiente++;
    else if (inc.estado === "en_proceso") estadoMap.en_proceso++;
    else if (inc.estado === "resuelto") estadoMap.resuelto++;

    const ag = inc.agente || "Sin asignar";
    const e = agMap.get(ag) || { p: 0, ep: 0, r: 0, tiempos: [] };
    if (inc.estado === "pendiente") e.p++;
    else if (inc.estado === "en_proceso") e.ep++;
    else if (inc.estado === "resuelto") e.r++;

    const pv = inc.punto_venta || "Sin especificar";
    const pvE = pvMap.get(pv) || { count: 0, tiempos: [] };
    pvE.count++;

    if (inc.fecha_cierre) {
      const diffMin = (new Date(inc.fecha_cierre).getTime() - new Date(inc.created_at).getTime()) / 60000;
      if (diffMin > 0) {
        tiemposGlobales.push(diffMin);
        e.tiempos.push(diffMin);
        pvE.tiempos.push(diffMin);

        const hours = diffMin / 60;
        if (hours < 1) timeBuckets.lt1h++;
        else if (hours < 6) timeBuckets.h1_6++;
        else if (hours < 24) timeBuckets.h6_24++;
        else if (hours < 72) timeBuckets.d1_3++;
        else timeBuckets.gt3d++;
      }
    }

    agMap.set(ag, e);
    pvMap.set(pv, pvE);

    const created = new Date(inc.created_at);
    const dow = (created.getDay() + 6) % 7;
    dayOfWeek[dow]++;
    const h = created.getHours();
    if (h <= 5) hourBand.madrugada++;
    else if (h <= 11) hourBand.manana++;
    else if (h <= 17) hourBand.tarde++;
    else hourBand.noche++;
  }

  const tiempoPromGlobal = tiemposGlobales.length
    ? tiemposGlobales.reduce((a, b) => a + b, 0) / tiemposGlobales.length
    : 0;
  const tiempoMin = tiemposGlobales.length ? Math.min(...tiemposGlobales) : 0;
  const tiempoMax = tiemposGlobales.length ? Math.max(...tiemposGlobales) : 0;

  const daysWithData = areaData.length;
  const sumCreated = areaData.reduce((s, d) => s + d.trafico, 0);
  const sumResolved = areaData.reduce((s, d) => s + d.conversiones, 0);
  const avgPerDay = daysWithData > 0 ? (sumCreated / daysWithData).toFixed(1) : "0";
  const resolutionRate = sumCreated > 0 ? sumResolved / sumCreated : 0;
  const busiestDay = areaData.reduce(
    (max, d) => (d.trafico > (max?.trafico ?? 0) ? d : max),
    areaData[0]
  );

  // ═══════════════════════════════════════════════════════════
  // HOJA 1: Dashboard (solo KPIs)
  // ═══════════════════════════════════════════════════════════
  const wsDash = wb.addWorksheet("Dashboard", {
    views: [{ showGridLines: false, zoomScale: 90 }],
    properties: { tabColor: { argb: AZUL } },
  });

  wsDash.getColumn(1).width = 2;
  for (let c = 2; c <= 17; c++) wsDash.getColumn(c).width = 12.5;
  wsDash.getColumn(18).width = 2;

  wsDash.mergeCells("B2:Q3");
  const titleCell = wsDash.getCell("B2");
  titleCell.value = "HUB Platform — Reporte de Analítica";
  titleCell.font = { bold: true, size: 24, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  titleCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

  wsDash.mergeCells("B4:Q4");
  const rangeCell = wsDash.getCell("B4");
  rangeCell.value = rangeLabel;
  rangeCell.font = { size: 10, color: { argb: GRAY }, name: "Calibri" };
    if (selectedAgente) rangeCell.font = { bold: true, size: 11, color: { argb: AZUL }, name: "Calibri" };
  rangeCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

  const kpis = [
    { label: "INCIDENTES REPORTADOS", value: totalIncidents, desc: "Total registrados", color: AZUL },
    { label: "PENDIENTES", value: estadoMap.pendiente, desc: "Esperando asignación", color: BLUE },
    { label: "EN PROCESO", value: estadoMap.en_proceso, desc: "Siendo atendidos", color: AZUL },
    { label: "RESUELTOS", value: estadoMap.resuelto, desc: "Cerrados con éxito", color: GREEN },
    { label: "TASA DE RESOLUCIÓN", value: resolutionRate, desc: "Resueltos ÷ creados", color: BLUE, isPct: true },
    { label: "TIEMPO PROMEDIO", value: fmtDuracion(Math.round(tiempoPromGlobal)), desc: "Tickets resueltos", color: BLUE },
    { label: "MÁS RÁPIDO", value: fmtDuracion(Math.round(tiempoMin)), desc: "Menor tiempo", color: GREEN },
    { label: "MÁS LENTO", value: fmtDuracion(Math.round(tiempoMax)), desc: "Mayor tiempo", color: "FFDC2626" },
  ];

  const kpiCols = [
    [2, 3], [4, 5], [6, 7], [8, 9], [10, 11], [12, 13], [14, 15], [16, 17],
  ];

  kpis.forEach((kpi, i) => {
    const [c1, c2] = kpiCols[i];

    wsDash.mergeCells(6, c1, 6, c2);
    const h = wsDash.getCell(6, c1);
    h.value = kpi.label;
    h.font = { bold: true, size: 9, color: { argb: "FFFFFFFF" }, name: "Calibri" };
    h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: kpi.color } };
    h.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    Object.assign(h, cellBorder);

    wsDash.mergeCells(7, c1, 7, c2);
    const v = wsDash.getCell(7, c1);
    v.value = kpi.isPct ? kpi.value : kpi.value;
    v.numFmt = kpi.isPct ? "0.0%" : typeof kpi.value === "number" ? "#,##0" : "@";
    v.font = {
      bold: true,
      size: typeof kpi.value === "string" || kpi.isPct ? 16 : 22,
      color: { argb: kpi.color },
      name: "Calibri",
    };
    v.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: i < 4 ? LIGHT_AZUL : LIGHT_BLUE },
    };
    v.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    Object.assign(v, cellBorder);
    wsDash.getRow(7).height = 40;

    wsDash.mergeCells(8, c1, 8, c2);
    const d = wsDash.getCell(8, c1);
    d.value = kpi.desc;
    d.font = { size: 9, color: { argb: GRAY }, name: "Calibri" };
    d.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: i < 4 ? LIGHT_AZUL : LIGHT_BLUE },
    };
    d.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    Object.assign(d, cellBorder);
  });

  // ═══════════════════════════════════════════════════════════
  // HOJA 2: Resumen
  // ═══════════════════════════════════════════════════════════
  const wsRes = wb.addWorksheet("Resumen", {
    views: [{ showGridLines: false, zoomScale: 90 }],
    properties: { tabColor: { argb: "FF3B348B" } },
  });

  wsRes.getColumn(1).width = 2;
  wsRes.getColumn(2).width = 28;
  wsRes.getColumn(3).width = 14;
  wsRes.getColumn(4).width = 14;
  wsRes.getColumn(5).width = 14;
  wsRes.getColumn(6).width = 14;
  wsRes.getColumn(7).width = 3;
  wsRes.getColumn(8).width = 26;
  wsRes.getColumn(9).width = 11;
  wsRes.getColumn(10).width = 11;
  wsRes.getColumn(11).width = 11;
  wsRes.getColumn(12).width = 11;
  wsRes.getColumn(13).width = 14;
  wsRes.getColumn(14).width = 13;

  wsRes.mergeCells("B2:N3");
  const tRes = wsRes.getCell("B2");
  tRes.value = "HUB Platform — Resumen de Datos";
  tRes.font = { bold: true, size: 20, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  tRes.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  tRes.alignment = { horizontal: "left", vertical: "middle", indent: 1 };

  wsRes.mergeCells("B4:N4");
  wsRes.getCell("B4").value = `${rangeLabel}   (todas las cifras se calculan con fórmulas sobre la hoja Detalle)`;
  wsRes.getCell("B4").font = { size: 10, color: { argb: GRAY }, name: "Calibri" };
    if (selectedAgente) wsRes.getCell("B4").font = { bold: true, size: 11, color: { argb: AZUL }, name: "Calibri" };

  // INDICADORES
  wsRes.mergeCells("B6:F6");
  const indHeader = wsRes.getCell("B6");
  indHeader.value = "INDICADORES";
  indHeader.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  indHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  indHeader.alignment = { horizontal: "center", vertical: "middle" };

  ["Métrica", "Valor", "Descripción"].forEach((l, i) => {
    const c = wsRes.getCell(7, 2 + i);
    c.value = l;
    Object.assign(c, headerStyle(LIGHT_AZUL));
    c.font = { bold: true, size: 10, color: { argb: AZUL }, name: "Calibri" };
  });

  const indicadores = [
    { metrica: "Incidentes Reportados", formula: `=COUNTA(Detalle!D6:D1000)`, desc: "Total de incidentes registrados" },
    { metrica: "Pendientes", formula: `=COUNTIF(Detalle!D6:D1000,"pendiente")`, desc: "A la espera de asignación" },
    { metrica: "En Proceso", formula: `=COUNTIF(Detalle!D6:D1000,"en_proceso")`, desc: "Siendo atendidos actualmente" },
    { metrica: "Resueltos", formula: `=COUNTIF(Detalle!D6:D1000,"resuelto")`, desc: "Cerrados exitosamente" },
    { metrica: "Tecnicos que atendieron", formula: `=COUNTIFS(H24:H27,"<>Sin asignar",L24:L27,">0")`, desc: "Técnicos con incidentes asignados" },
    { metrica: "Resueltos con solución", formula: `=COUNTIFS(Detalle!D6:D1000,"resuelto",Detalle!G6:G1000,"<>")`, desc: "Tickets cerrados con descripción de solución" },
    { metrica: "Tiempo promedio global", formula: `=IFERROR(INT(ROUND(AVERAGE(Detalle!J6:J1000)*60,0)/60)&" h "&MOD(ROUND(AVERAGE(Detalle!J6:J1000)*60,0),60)&" min","—")`, desc: "Promedio de todos los tickets resueltos" },
    { metrica: "Ticket más rápido", formula: `=IFERROR(INT(ROUND(MIN(Detalle!J6:J1000)*60,0)/60)&" h "&MOD(ROUND(MIN(Detalle!J6:J1000)*60,0),60)&" min","—")`, desc: "Menor tiempo de resolución" },
    { metrica: "Ticket más lento", formula: `=IFERROR(INT(ROUND(MAX(Detalle!J6:J1000)*60,0)/60)&" h "&MOD(ROUND(MAX(Detalle!J6:J1000)*60,0),60)&" min","—")`, desc: "Mayor tiempo de resolución" },
  ];

  indicadores.forEach((ind, i) => {
    const r = 8 + i;
    wsRes.getCell(r, 2).value = ind.metrica;
    wsRes.getCell(r, 2).font = { bold: true, size: 10, color: { argb: AZUL }, name: "Calibri" };
    wsRes.getCell(r, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_AZUL } };
    Object.assign(wsRes.getCell(r, 2), cellBorder);

    wsRes.getCell(r, 3).value = { formula: ind.formula };
    wsRes.getCell(r, 3).font = { bold: true, size: 11, color: { argb: DARK }, name: "Calibri" };
    wsRes.getCell(r, 3).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 3), cellBorder);

    wsRes.getCell(r, 4).value = ind.desc;
    wsRes.getCell(r, 4).font = { size: 9, color: { argb: GRAY }, name: "Calibri" };
    Object.assign(wsRes.getCell(r, 4), cellBorder);
    wsRes.mergeCells(r, 4, r, 6);
  });

  // INCIDENTES POR PUNTO DE VENTA
  wsRes.mergeCells("H6:K6");
  const pvH = wsRes.getCell("H6");
  pvH.value = "INCIDENTES POR PUNTO DE VENTA";
  pvH.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  pvH.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  pvH.alignment = { horizontal: "center", vertical: "middle" };

  ["Punto de Venta", "Cant.", "%", "T. Prom. (h)"].forEach((l, i) => {
    const c = wsRes.getCell(7, 8 + i);
    c.value = l;
    Object.assign(c, headerStyle(LIGHT_AZUL));
    c.font = { bold: true, size: 10, color: { argb: AZUL }, name: "Calibri" };
  });

  const pvSorted = Array.from(pvMap.entries()).sort((a, b) => b[1].count - a[1].count);
  pvSorted.forEach(([name], i) => {
    const r = 8 + i;
    wsRes.getCell(r, 8).value = name;
    wsRes.getCell(r, 8).font = { bold: true, size: 10, color: { argb: AZUL }, name: "Calibri" };
    wsRes.getCell(r, 8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_AZUL } };
    Object.assign(wsRes.getCell(r, 8), cellBorder);

    wsRes.getCell(r, 9).value = { formula: `=COUNTIF(Detalle!C6:C1000,H${r})` };
    wsRes.getCell(r, 9).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 9), cellBorder);

    wsRes.getCell(r, 10).value = { formula: `=IFERROR(I${r}/$I$${8 + pvSorted.length},0)` };
    wsRes.getCell(r, 10).numFmt = "0%";
    wsRes.getCell(r, 10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
    wsRes.getCell(r, 10).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 10), cellBorder);

    wsRes.getCell(r, 11).value = {
      formula: `=IFERROR(AVERAGEIFS(Detalle!J6:J1000,Detalle!C6:C1000,H${r}),"—")`,
    };
    wsRes.getCell(r, 11).numFmt = '0.0 "h"';
    wsRes.getCell(r, 11).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 11), cellBorder);
  });

  const totPvRow = 8 + pvSorted.length;
  wsRes.getCell(totPvRow, 8).value = "TOTAL";
  wsRes.getCell(totPvRow, 8).font = { bold: true, size: 10, color: { argb: AZUL }, name: "Calibri" };
  wsRes.getCell(totPvRow, 8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  Object.assign(wsRes.getCell(totPvRow, 8), cellBorder);
  wsRes.getCell(totPvRow, 9).value = { formula: `=SUM(I8:I${totPvRow - 1})` };
  wsRes.getCell(totPvRow, 9).font = { bold: true };
  wsRes.getCell(totPvRow, 9).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  Object.assign(wsRes.getCell(totPvRow, 9), cellBorder);
  wsRes.getCell(totPvRow, 10).value = { formula: `=SUM(J8:J${totPvRow - 1})` };
  wsRes.getCell(totPvRow, 10).numFmt = "0%";
  wsRes.getCell(totPvRow, 10).font = { bold: true };
  wsRes.getCell(totPvRow, 10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  Object.assign(wsRes.getCell(totPvRow, 10), cellBorder);

  // INCIDENTES POR ESTADO
  wsRes.mergeCells("H15:J15");
  const estH = wsRes.getCell("H15");
  estH.value = "INCIDENTES POR ESTADO";
  estH.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  estH.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  estH.alignment = { horizontal: "center" };

  ["Estado", "Cant.", "%"].forEach((l, i) => {
    const c = wsRes.getCell(16, 8 + i);
    c.value = l;
    Object.assign(c, headerStyle(LIGHT_AZUL));
    c.font = { bold: true, size: 10, color: { argb: AZUL }, name: "Calibri" };
  });

  const estados = [
    { name: "Pendiente", key: "pendiente", color: BLUE },
    { name: "En Proceso", key: "en_proceso", color: AZUL },
    { name: "Resuelto", key: "resuelto", color: GREEN },
  ];
  estados.forEach((e, i) => {
    const r = 17 + i;
    wsRes.getCell(r, 8).value = e.name;
    wsRes.getCell(r, 8).font = { bold: true, size: 10, color: { argb: e.color }, name: "Calibri" };
    wsRes.getCell(r, 8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_AZUL } };
    Object.assign(wsRes.getCell(r, 8), cellBorder);

    wsRes.getCell(r, 9).value = { formula: `=COUNTIF(Detalle!D6:D1000,"${e.key}")` };
    wsRes.getCell(r, 9).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 9), cellBorder);

    wsRes.getCell(r, 10).value = { formula: `=IFERROR(I${r}/$I$20,0)` };
    wsRes.getCell(r, 10).numFmt = "0%";
    wsRes.getCell(r, 10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
    wsRes.getCell(r, 10).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 10), cellBorder);
  });

  wsRes.getCell(20, 8).value = "TOTAL";
  wsRes.getCell(20, 8).font = { bold: true, size: 10, color: { argb: AZUL }, name: "Calibri" };
  wsRes.getCell(20, 8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  Object.assign(wsRes.getCell(20, 8), cellBorder);
  wsRes.getCell(20, 9).value = { formula: "=SUM(I17:I19)" };
  wsRes.getCell(20, 9).font = { bold: true };
  wsRes.getCell(20, 9).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  Object.assign(wsRes.getCell(20, 9), cellBorder);
  wsRes.getCell(20, 10).value = { formula: "=SUM(J17:J19)" };
  wsRes.getCell(20, 10).numFmt = "0%";
  wsRes.getCell(20, 10).font = { bold: true };
  wsRes.getCell(20, 10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  Object.assign(wsRes.getCell(20, 10), cellBorder);

  // RESUMEN POR Tecnico
  wsRes.mergeCells("H22:N22");
  const agH = wsRes.getCell("H22");
  agH.value = "RESUMEN POR Tecnico";
  agH.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  agH.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  agH.alignment = { horizontal: "center" };

  ["Técnico", "Pend.", "Proceso", "Res.", "Total", "T. Prom.", "T. Prom. (h)"].forEach((l, i) => {
    const c = wsRes.getCell(23, 8 + i);
    c.value = l;
    Object.assign(c, headerStyle(LIGHT_AZUL));
    c.font = { bold: true, size: 10, color: { argb: AZUL }, name: "Calibri" };
  });

  const agRows = Array.from(agMap.entries()).map(([ag, c]) => ({
    ag,
    p: c.p,
    ep: c.ep,
    r: c.r,
    total: c.p + c.ep + c.r,
  }));

  agRows.sort((a, b) => {
    if (a.ag === "Sin asignar") return -1;
    if (b.ag === "Sin asignar") return 1;
    return b.total - a.total;
  });

  agRows.forEach((row, i) => {
    const r = 24 + i;
    wsRes.getCell(r, 8).value = row.ag;
    wsRes.getCell(r, 8).font = { bold: true, size: 10, color: { argb: AZUL }, name: "Calibri" };
    wsRes.getCell(r, 8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_AZUL } };
    Object.assign(wsRes.getCell(r, 8), cellBorder);

    wsRes.getCell(r, 9).value = {
      formula: `=COUNTIFS(Detalle!E6:E1000,$H${r},Detalle!D6:D1000,"pendiente")`,
    };
    wsRes.getCell(r, 9).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 9), cellBorder);

    wsRes.getCell(r, 10).value = {
      formula: `=COUNTIFS(Detalle!E6:E1000,$H${r},Detalle!D6:D1000,"en_proceso")`,
    };
    wsRes.getCell(r, 10).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 10), cellBorder);

    wsRes.getCell(r, 11).value = {
      formula: `=COUNTIFS(Detalle!E6:E1000,$H${r},Detalle!D6:D1000,"resuelto")`,
    };
    wsRes.getCell(r, 11).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 11), cellBorder);

    wsRes.getCell(r, 12).value = { formula: `=SUM(I${r}:K${r})` };
    wsRes.getCell(r, 12).font = { bold: true };
    wsRes.getCell(r, 12).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
    wsRes.getCell(r, 12).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 12), cellBorder);

    wsRes.getCell(r, 13).value = {
      formula: `=IF(N${r}="","—",IFERROR(INT(ROUND(N${r}*60,0)/60)&" h "&MOD(ROUND(N${r}*60,0),60)&" min","—"))`,
    };
    wsRes.getCell(r, 13).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 13), cellBorder);

    wsRes.getCell(r, 14).value = {
      formula: `=IFERROR(AVERAGEIFS(Detalle!J6:J1000,Detalle!E6:E1000,$H${r}),"")`,
    };
    wsRes.getCell(r, 14).numFmt = "0.0";
    wsRes.getCell(r, 14).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
    wsRes.getCell(r, 14).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 14), cellBorder);
  });

  const totAgRow = 24 + agRows.length;
  wsRes.getCell(totAgRow, 8).value = "TOTAL";
  wsRes.getCell(totAgRow, 8).font = { bold: true, size: 10, color: { argb: AZUL }, name: "Calibri" };
  wsRes.getCell(totAgRow, 8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  Object.assign(wsRes.getCell(totAgRow, 8), cellBorder);
  ["I", "J", "K", "L"].forEach((col) => {
    const cell = wsRes.getCell(`${col}${totAgRow}`);
    cell.value = { formula: `=SUM(${col}24:${col}${totAgRow - 1})` };
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
    cell.alignment = { horizontal: "center" };
    Object.assign(cell, cellBorder);
  });

  // ESTADÍSTICAS DEL PERÍODO
  wsRes.mergeCells("B18:F18");
  const estPerH = wsRes.getCell("B18");
  estPerH.value = "ESTADÍSTICAS DEL PERÍODO";
  estPerH.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  estPerH.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  estPerH.alignment = { horizontal: "center" };

  ["Métrica", "Valor", "Detalle"].forEach((l, i) => {
    const c = wsRes.getCell(19, 2 + i);
    c.value = l;
    Object.assign(c, headerStyle(LIGHT_AZUL));
    c.font = { bold: true, size: 10, color: { argb: AZUL }, name: "Calibri" };
  });

  const statsPeriodo = [
    { m: "Días con actividad", v: `${daysWithData} días`, d: "Días con al menos un incidente" },
    { m: "Promedio diario", v: `${avgPerDay} inc./día`, d: "Creados ÷ días con actividad" },
    { m: "Total creados", v: sumCreated, d: "Incidentes abiertos en el rango" },
    { m: "Total resueltos", v: sumResolved, d: "Resueltos de los creados en el rango" },
    { m: "Tasa de resolución", v: resolutionRate, d: "Resueltos ÷ creados", isPct: true },
    {
      m: "Día más activo",
      v: busiestDay ? busiestDay.name : "N/A",
      d: busiestDay ? `${busiestDay.trafico} incidentes ese día` : "",
    },
  ];

  statsPeriodo.forEach((s, i) => {
    const r = 20 + i;
    wsRes.getCell(r, 2).value = s.m;
    wsRes.getCell(r, 2).font = { bold: true, size: 10, color: { argb: AZUL }, name: "Calibri" };
    wsRes.getCell(r, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_AZUL } };
    Object.assign(wsRes.getCell(r, 2), cellBorder);

    wsRes.getCell(r, 3).value = s.v as any;
    if (s.isPct) wsRes.getCell(r, 3).numFmt = "0.0%";
    wsRes.getCell(r, 3).font = { bold: true, size: 11, color: { argb: DARK }, name: "Calibri" };
    wsRes.getCell(r, 3).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 3), cellBorder);

    wsRes.getCell(r, 4).value = s.d;
    wsRes.getCell(r, 4).font = { size: 9, color: { argb: GRAY }, name: "Calibri" };
    Object.assign(wsRes.getCell(r, 4), cellBorder);
    wsRes.mergeCells(r, 4, r, 6);
  });

  // EVOLUCIÓN DIARIA
  wsRes.mergeCells("B27:F27");
  const evoH = wsRes.getCell("B27");
  evoH.value = "EVOLUCIÓN DIARIA";
  evoH.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  evoH.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  evoH.alignment = { horizontal: "center" };

  ["Fecha", "Creados", "Resueltos", "Netos", "Acumulado"].forEach((l, i) => {
    const c = wsRes.getCell(28, 2 + i);
    c.value = l;
    Object.assign(c, headerStyle(LIGHT_AZUL));
    c.font = { bold: true, size: 10, color: { argb: AZUL }, name: "Calibri" };
  });

  let running = 0;
  areaData.forEach((d, i) => {
    const r = 29 + i;
    const netos = d.trafico - d.conversiones;
    running += netos;

    wsRes.getCell(r, 2).value = d.name;
    wsRes.getCell(r, 2).font = { bold: true, size: 10, color: { argb: AZUL }, name: "Calibri" };
    wsRes.getCell(r, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_AZUL } };
    Object.assign(wsRes.getCell(r, 2), cellBorder);

    wsRes.getCell(r, 3).value = d.trafico;
    wsRes.getCell(r, 3).numFmt = "#,##0";
    wsRes.getCell(r, 3).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 3), cellBorder);

    wsRes.getCell(r, 4).value = d.conversiones;
    wsRes.getCell(r, 4).numFmt = "#,##0";
    wsRes.getCell(r, 4).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 4), cellBorder);

    wsRes.getCell(r, 5).value = netos;
    wsRes.getCell(r, 5).numFmt = "#,##0;-#,##0;0";
    wsRes.getCell(r, 5).font = {
      color: { argb: netos > 0 ? "FFEF4444" : netos < 0 ? "FF16A34A" : "FF6B7280" },
      name: "Calibri",
    };
    wsRes.getCell(r, 5).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 5), cellBorder);

    wsRes.getCell(r, 6).value = running;
    wsRes.getCell(r, 6).numFmt = "#,##0";
    wsRes.getCell(r, 6).font = { bold: true, color: { argb: AZUL }, name: "Calibri" };
    wsRes.getCell(r, 6).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 6), cellBorder);
  });

  const totEvo = 29 + areaData.length;
  wsRes.getCell(totEvo, 2).value = "TOTAL";
  wsRes.getCell(totEvo, 2).font = { bold: true, size: 10, color: { argb: AZUL }, name: "Calibri" };
  wsRes.getCell(totEvo, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  Object.assign(wsRes.getCell(totEvo, 2), cellBorder);
  wsRes.getCell(totEvo, 3).value = sumCreated;
  wsRes.getCell(totEvo, 3).font = { bold: true };
  wsRes.getCell(totEvo, 3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  Object.assign(wsRes.getCell(totEvo, 3), cellBorder);
  wsRes.getCell(totEvo, 4).value = sumResolved;
  wsRes.getCell(totEvo, 4).font = { bold: true };
  wsRes.getCell(totEvo, 4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  Object.assign(wsRes.getCell(totEvo, 4), cellBorder);
  wsRes.getCell(totEvo, 5).value = sumCreated - sumResolved;
  wsRes.getCell(totEvo, 5).font = { bold: true };
  wsRes.getCell(totEvo, 5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  Object.assign(wsRes.getCell(totEvo, 5), cellBorder);
  wsRes.getCell(totEvo, 6).value = running;
  wsRes.getCell(totEvo, 6).font = { bold: true, color: { argb: AZUL } };
  wsRes.getCell(totEvo, 6).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
  Object.assign(wsRes.getCell(totEvo, 6), cellBorder);

  wsRes.getCell(totEvo + 1, 2).value =
    "Resueltos = tickets creados ese día que ya están resueltos. Netos = creados − resueltos.";
  wsRes.getCell(totEvo + 1, 2).font = { size: 8, color: { argb: "FF9CA3AF" }, name: "Calibri" };
  wsRes.mergeCells(totEvo + 1, 2, totEvo + 1, 6);

  // DISTRIBUCIÓN DE TIEMPOS
  wsRes.mergeCells("H30:J30");
  const distH = wsRes.getCell("H30");
  distH.value = "DISTRIBUCIÓN DE TIEMPOS DE RESOLUCIÓN";
  distH.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  distH.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  distH.alignment = { horizontal: "center" };

  ["Rango", "Cant.", "%"].forEach((l, i) => {
    const c = wsRes.getCell(31, 8 + i);
    c.value = l;
    Object.assign(c, headerStyle("FFCAEFFF"));
    c.font = { bold: true, size: 10, color: { argb: "FF0287D0" }, name: "Calibri" };
  });

  const buckets = [
    { label: "Menos de 1 h", val: timeBuckets.lt1h },
    { label: "1 h – 6 h", val: timeBuckets.h1_6 },
    { label: "6 h – 24 h", val: timeBuckets.h6_24 },
    { label: "1 – 3 días", val: timeBuckets.d1_3 },
    { label: "Más de 3 días", val: timeBuckets.gt3d },
  ];
  const totalResolvedTime = Object.values(timeBuckets).reduce((a, b) => a + b, 0) || 1;

  buckets.forEach((b, i) => {
    const r = 32 + i;
    wsRes.getCell(r, 8).value = b.label;
    wsRes.getCell(r, 8).font = { bold: true, size: 10, color: { argb: "FF0287D0" }, name: "Calibri" };
    wsRes.getCell(r, 8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BLUE } };
    Object.assign(wsRes.getCell(r, 8), cellBorder);

    wsRes.getCell(r, 9).value = b.val;
    wsRes.getCell(r, 9).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 9), cellBorder);

    wsRes.getCell(r, 10).value = b.val / totalResolvedTime;
    wsRes.getCell(r, 10).numFmt = "0%";
    wsRes.getCell(r, 10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
    wsRes.getCell(r, 10).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 10), cellBorder);
  });

  // DÍA DE LA SEMANA
  wsRes.mergeCells("B40:D40");
  const dowH = wsRes.getCell("B40");
  dowH.value = "INCIDENTES POR DÍA DE LA SEMANA";
  dowH.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  dowH.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  dowH.alignment = { horizontal: "center" };

  ["Día", "Cant.", "%"].forEach((l, i) => {
    const c = wsRes.getCell(41, 2 + i);
    c.value = l;
    Object.assign(c, headerStyle("FFCAEFFF"));
    c.font = { bold: true, size: 10, color: { argb: "FF0287D0" }, name: "Calibri" };
  });

  const dias = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const totalDow = dayOfWeek.reduce((a, b) => a + b, 0) || 1;
  dias.forEach((dia, i) => {
    const r = 42 + i;
    wsRes.getCell(r, 2).value = dia;
    wsRes.getCell(r, 2).font = { bold: true, size: 10, color: { argb: "FF0287D0" }, name: "Calibri" };
    wsRes.getCell(r, 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BLUE } };
    Object.assign(wsRes.getCell(r, 2), cellBorder);

    wsRes.getCell(r, 3).value = dayOfWeek[i];
    wsRes.getCell(r, 3).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 3), cellBorder);

    wsRes.getCell(r, 4).value = dayOfWeek[i] / totalDow;
    wsRes.getCell(r, 4).numFmt = "0%";
    wsRes.getCell(r, 4).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
    wsRes.getCell(r, 4).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 4), cellBorder);
  });

  // FRANJA HORARIA
  wsRes.mergeCells("H38:J38");
  const franH = wsRes.getCell("H38");
  franH.value = "INCIDENTES POR FRANJA HORARIA";
  franH.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  franH.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
  franH.alignment = { horizontal: "center" };

  ["Franja", "Cant.", "%"].forEach((l, i) => {
    const c = wsRes.getCell(39, 8 + i);
    c.value = l;
    Object.assign(c, headerStyle("FFCAEFFF"));
    c.font = { bold: true, size: 10, color: { argb: "FF0287D0" }, name: "Calibri" };
  });

  const franjas = [
    { label: "Madrugada (0–5 h)", val: hourBand.madrugada },
    { label: "Mañana (6–11 h)", val: hourBand.manana },
    { label: "Tarde (12–17 h)", val: hourBand.tarde },
    { label: "Noche (18–23 h)", val: hourBand.noche },
  ];
  const totalFran = Object.values(hourBand).reduce((a, b) => a + b, 0) || 1;

  franjas.forEach((f, i) => {
    const r = 40 + i;
    wsRes.getCell(r, 8).value = f.label;
    wsRes.getCell(r, 8).font = { bold: true, size: 10, color: { argb: "FF0287D0" }, name: "Calibri" };
    wsRes.getCell(r, 8).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BLUE } };
    Object.assign(wsRes.getCell(r, 8), cellBorder);

    wsRes.getCell(r, 9).value = f.val;
    wsRes.getCell(r, 9).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 9), cellBorder);

    wsRes.getCell(r, 10).value = f.val / totalFran;
    wsRes.getCell(r, 10).numFmt = "0%";
    wsRes.getCell(r, 10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
    wsRes.getCell(r, 10).alignment = { horizontal: "center" };
    Object.assign(wsRes.getCell(r, 10), cellBorder);
  });

  // ═══════════════════════════════════════════════════════════
  // HOJA 3: Detalle
  // ═══════════════════════════════════════════════════════════
  const wsDet = wb.addWorksheet("Detalle", {
    views: [{ state: "frozen", ySplit: 5, showGridLines: false }],
    properties: { tabColor: { argb: BLUE } },
  });

  const detWidths = [16, 22, 24, 14, 22, 40, 40, 20, 20, 12, 18, 14, 10, 8];
  detWidths.forEach((w, i) => (wsDet.getColumn(i + 1).width = w));

  wsDet.mergeCells("A3:N3");
  const detTitle = wsDet.getCell("A3");
  detTitle.value = "Detalle de Incidentes";
  detTitle.font = { size: 22, color: { argb: BLUE }, name: "Calibri Light" };
  detTitle.alignment = { horizontal: "left", vertical: "middle" };

  wsDet.mergeCells("A4:N4");
  wsDet.getCell("A4").value =
    "Tiempo de resolución:  verde < 30 min  ·  ámbar < 2 h  ·  rojo ≥ 2 h.   Las columnas en gris (J–N) se calculan solas con fórmulas.";
  wsDet.getCell("A4").font = { size: 9, color: { argb: GRAY }, name: "Calibri" };

  const detHeaders = [
    "Código del punto", "Nombre", "Punto de Venta", "Estado", "Técnico",
    "Descripción", "Solución", "Creado", "Cierre",
    "Tiempo (h)", "Tiempo de Resolución", "Fecha creación", "Día (1=Lun)", "Hora",
  ];

  detHeaders.forEach((h, i) => {
    const cell = wsDet.getCell(5, i + 1);
    cell.value = h;
    Object.assign(cell, headerStyle(AZUL));
    cell.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" }, name: "Calibri" };
  });
  wsDet.getRow(5).height = 22;

  incidents.forEach((inc, i) => {
    const r = 6 + i;
    const isZebra = i % 2 === 1;

    wsDet.getCell(r, 1).value = inc.documento || "";
    wsDet.getCell(r, 2).value = inc.nombre || "";
    wsDet.getCell(r, 3).value = inc.punto_venta || "";
    wsDet.getCell(r, 4).value = inc.estado || "";
    wsDet.getCell(r, 5).value = inc.agente || "Sin asignar";
    wsDet.getCell(r, 6).value = inc.descripcion || "";
    wsDet.getCell(r, 7).value = inc.solucion || "";
    wsDet.getCell(r, 8).value = new Date(inc.created_at);
    wsDet.getCell(r, 8).numFmt = "dd/mm/yyyy hh:mm";
    wsDet.getCell(r, 9).value = inc.fecha_cierre ? new Date(inc.fecha_cierre) : null;
    if (inc.fecha_cierre) wsDet.getCell(r, 9).numFmt = "dd/mm/yyyy hh:mm";

    wsDet.getCell(r, 10).value = { formula: `=IF(I${r}="","",(I${r}-H${r})*24)` };
    wsDet.getCell(r, 10).numFmt = "0.0";
    wsDet.getCell(r, 10).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F2F2" } };

    wsDet.getCell(r, 11).value = {
      formula: `=IF(I${r}="","No resuelto",INT(ROUND(J${r}*60,0)/60)&" h "&MOD(ROUND(J${r}*60,0),60)&" min")`,
    };
    wsDet.getCell(r, 11).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F2F2" } };

    wsDet.getCell(r, 12).value = { formula: `=INT(H${r})` };
    wsDet.getCell(r, 12).numFmt = 'd "de" mmm';
    wsDet.getCell(r, 12).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F2F2" } };

    wsDet.getCell(r, 13).value = { formula: `=WEEKDAY(H${r},2)` };
    wsDet.getCell(r, 13).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F2F2" } };

    wsDet.getCell(r, 14).value = { formula: `=HOUR(H${r})` };
    wsDet.getCell(r, 14).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F2F2" } };

    for (let c = 1; c <= 14; c++) {
      const cell = wsDet.getCell(r, c);
      cell.font = { size: 10, color: { argb: "FF404040" }, name: "Calibri" };
      cell.alignment = {
        horizontal: c >= 8 ? "center" : "left",
        vertical: "middle",
        wrapText: c === 6 || c === 7,
      };
      Object.assign(cell, cellBorder);
      if (isZebra && c <= 9) cell.fill = zebraFill;
    }

    const estadoCell = wsDet.getCell(r, 4);
    if (inc.estado === "pendiente") {
      estadoCell.font = { bold: true, size: 10, color: { argb: "FF0287D0" }, name: "Calibri" };
      estadoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCAEFFF" } };
    } else if (inc.estado === "en_proceso") {
      estadoCell.font = { bold: true, size: 10, color: { argb: "FF6D28D9" }, name: "Calibri" };
      estadoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDE4FD" } };
    } else if (inc.estado === "resuelto") {
      estadoCell.font = { bold: true, size: 10, color: { argb: "FF15803D" }, name: "Calibri" };
      estadoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCFCE7" } };
    }
  });

  if (incidents.length > 0) {
    wsDet.autoFilter = {
      from: { row: 5, column: 1 },
      to: { row: 5 + incidents.length, column: 14 },
    };
  }

  // Guardar Excel
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `analitica_hub${rangeSuffix}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────────────────────
// EXPORTAR PDF — Informe profesional de analítica
// ─────────────────────────────────────────────────────────────

async function handleExportPDF(
  appliedRange: { start: string; end: string } | null,
  filter: FilterPreset,
  areaData: AreaDataPoint[],
  selectedAgente?: string
) {
  const { default: jsPDF } = await import("jspdf");

  // ── 1. Traer datos ──
  const effectiveRange = appliedRange || getDateRange(filter);
  let incidents: IncidentExport[] = [];
  try {
    const qs = `?start=${effectiveRange.start}&end=${effectiveRange.end}`;
    const incData = await api.get<{ items: IncidentExport[] }>(`/incidents/export-data${qs}`);
    incidents = incData.items || [];
    if (selectedAgente) incidents = incidents.filter((inc) => inc.agente === selectedAgente);
  } catch (err) {
    logger.warn("PDF export fetch failed", { error: (err as Error).message });
  }

  // ── 2. Cálculos ──
  const total = incidents.length;
  const estadoMap = { pendiente: 0, en_proceso: 0, resuelto: 0 };
  const agMap = new Map<string, { p: number; ep: number; r: number; tiempos: number[] }>();
  const pvMap = new Map<string, number>();
  const tiempos: number[] = [];

  for (const inc of incidents) {
    if (inc.estado === "pendiente") estadoMap.pendiente++;
    else if (inc.estado === "en_proceso") estadoMap.en_proceso++;
    else if (inc.estado === "resuelto") estadoMap.resuelto++;

    const ag = inc.agente || "Sin asignar";
    const e = agMap.get(ag) || { p: 0, ep: 0, r: 0, tiempos: [] };
    if (inc.estado === "pendiente") e.p++;
    else if (inc.estado === "en_proceso") e.ep++;
    else if (inc.estado === "resuelto") e.r++;

    if (inc.fecha_cierre) {
      const diff = (new Date(inc.fecha_cierre).getTime() - new Date(inc.created_at).getTime()) / 60000;
      if (diff > 0) {
        tiempos.push(diff);
        e.tiempos.push(diff);
      }
    }
    agMap.set(ag, e);

    const pv = inc.punto_venta || "Sin especificar";
    pvMap.set(pv, (pvMap.get(pv) || 0) + 1);
  }

  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const tiempoProm = tiempos.length ? tiempos.reduce((a, b) => a + b, 0) / tiempos.length : 0;
  const tiempoMin = tiempos.length ? Math.min(...tiempos) : 0;
  const tiempoMax = tiempos.length ? Math.max(...tiempos) : 0;
  const agentesReales = [...agMap.keys()].filter((a) => a !== "Sin asignar").length;
  const resueltosConSolucion = incidents.filter((i) => i.estado === "resuelto" && i.solucion).length;

  const daysWithData = areaData.length;
  const sumCreated = areaData.reduce((s, d) => s + d.trafico, 0);
  const sumResolved = areaData.reduce((s, d) => s + d.conversiones, 0);
  const avgPerDay = daysWithData > 0 ? (sumCreated / daysWithData).toFixed(1) : "0";
  const busiestDay = areaData.reduce((max, d) => (d.trafico > (max?.trafico ?? 0) ? d : max), areaData[0]);

  const pvSorted = Array.from(pvMap.entries()).sort((a, b) => b[1] - a[1]);
  const agRows = Array.from(agMap.entries())
    .map(([ag, c]) => ({
      ag,
      p: c.p,
      ep: c.ep,
      r: c.r,
      total: c.p + c.ep + c.r,
      prom: c.tiempos.length ? c.tiempos.reduce((a, b) => a + b, 0) / c.tiempos.length : null,
    }))
    .sort((a, b) => {
      if (a.ag === "Sin asignar") return -1;
      if (b.ag === "Sin asignar") return 1;
      return b.total - a.total;
    });

  // ── 3. Generar PDF ──
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const contentW = pageW - margin * 2;
  let y = 20;

  const checkPage = (needed = 12) => {
    if (y + needed > 280) {
      doc.addPage();
      y = 20;
    }
  };

  const title = (text: string) => {
    checkPage(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(37, 32, 126);
    doc.text(text, margin, y);
    y += 7;
  };

  const body = (text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    const lines = doc.splitTextToSize(text, contentW);
    checkPage(lines.length * 5 + 4);
    doc.text(lines, margin, y);
    y += lines.length * 5 + 3;
  };

  const small = (text: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const lines = doc.splitTextToSize(text, contentW);
    checkPage(lines.length * 4.5 + 3);
    doc.text(lines, margin, y);
    y += lines.length * 4.5 + 2;
  };

  // ── Portada / Encabezado ──
  doc.setFillColor(37, 32, 126);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("Informe de Analítica — HUB Platform", margin, 12);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Período: ${formatDateRange(effectiveRange.start, effectiveRange.end)}`,
    margin,
    19
  );
  doc.text(
    `Generado: ${new Date().toLocaleDateString("es-CO", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}`,
    margin,
    24
  );

  y = 38;

    // Aviso cuando el informe está filtrado por un técnico
  if (selectedAgente) {
    doc.setFillColor(238, 237, 248);
    doc.setDrawColor(37, 32, 126);
    doc.setLineWidth(0.5);
    doc.rect(margin, y, contentW, 13, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(37, 32, 126);
    doc.text(`FILTRO APLICADO: Técnico — ${selectedAgente}`, margin + 3, y + 5.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text("Este informe solo incluye los tickets atendidos por este técnico.", margin + 3, y + 10.5);
    y += 19;
  }

  // ── 1. Resumen Ejecutivo ──
  title("1. Resumen Ejecutivo");
  body(
    `Durante el período analizado se registraron ${total} incidentes en la plataforma HUB, de los cuales ${estadoMap.resuelto} fueron resueltos (${pct(estadoMap.resuelto)}%), ${estadoMap.pendiente} permanecen pendientes (${pct(estadoMap.pendiente)}%) y ${estadoMap.en_proceso} se encuentran en proceso (${pct(estadoMap.en_proceso)}%). Se contó con la participación de ${agentesReales} técnicos que atendieron incidentes asignados.`
  );
  body(
    `El tiempo promedio global de resolución fue de ${fmtDuracion(Math.round(tiempoProm))}, con un ticket más rápido resuelto en ${fmtDuracion(Math.round(tiempoMin))} y uno más lento que tomó ${fmtDuracion(Math.round(tiempoMax))}. La actividad se concentró en ${daysWithData} días, con un promedio de ${avgPerDay} incidentes diarios${busiestDay ? `, siendo el ${busiestDay.name} el día más activo con ${busiestDay.trafico} incidentes reportados` : ""}.`
  );

  // ── 2. Métricas Generales ──
  title("2. Métricas Generales del Período");
  const metricsRows = [
    ["Incidentes reportados", String(total)],
    ["Pendientes", `${estadoMap.pendiente} (${pct(estadoMap.pendiente)}%)`],
    ["En proceso", `${estadoMap.en_proceso} (${pct(estadoMap.en_proceso)}%)`],
    ["Resueltos", `${estadoMap.resuelto} (${pct(estadoMap.resuelto)}%)`],
    ["Agentes que atendieron", String(agentesReales)],
    ["Resueltos con solución documentada", `${resueltosConSolucion} (${estadoMap.resuelto ? Math.round((resueltosConSolucion / estadoMap.resuelto) * 100) : 0}% de los resueltos)`],
    ["Tiempo promedio global", fmtDuracion(Math.round(tiempoProm))],
    ["Ticket más rápido", fmtDuracion(Math.round(tiempoMin))],
    ["Ticket más lento", fmtDuracion(Math.round(tiempoMax))],
    ["Días con actividad", `${daysWithData} días`],
    ["Promedio diario", `${avgPerDay} incidentes/día`],
    ["Tasa de resolución", `${pct(estadoMap.resuelto)}%`],
  ];

  // Tabla simple
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setFillColor(37, 32, 126);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y, contentW * 0.55, 7, "F");
  doc.rect(margin + contentW * 0.55, y, contentW * 0.45, 7, "F");
  doc.text("Métrica", margin + 2, y + 5);
  doc.text("Valor", margin + contentW * 0.55 + 2, y + 5);
  y += 7;

  metricsRows.forEach((row, i) => {
    checkPage(7);
    if (i % 2 === 0) {
      doc.setFillColor(238, 237, 248);
      doc.rect(margin, y, contentW, 6.5, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(row[0], margin + 2, y + 4.5);
    doc.setFont("helvetica", "bold");
    doc.text(row[1], margin + contentW * 0.55 + 2, y + 4.5);
    y += 6.5;
  });
  y += 4;

  // ── 3. Punto de Venta ──
  title("3. Distribución por Punto de Venta");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setFillColor(37, 32, 126);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y, contentW * 0.5, 7, "F");
  doc.rect(margin + contentW * 0.5, y, contentW * 0.25, 7, "F");
  doc.rect(margin + contentW * 0.75, y, contentW * 0.25, 7, "F");
  doc.text("Punto de Venta", margin + 2, y + 5);
  doc.text("Cantidad", margin + contentW * 0.5 + 2, y + 5);
  doc.text("%", margin + contentW * 0.75 + 2, y + 5);
  y += 7;

  pvSorted.forEach(([name, count], i) => {
    checkPage(7);
    if (i % 2 === 0) {
      doc.setFillColor(238, 237, 248);
      doc.rect(margin, y, contentW, 6.5, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(name, margin + 2, y + 4.5);
    doc.text(String(count), margin + contentW * 0.5 + 2, y + 4.5);
    doc.text(`${pct(count)}%`, margin + contentW * 0.75 + 2, y + 4.5);
    y += 6.5;
  });
  // Total
  doc.setFillColor(242, 242, 242);
  doc.rect(margin, y, contentW, 6.5, "F");
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL", margin + 2, y + 4.5);
  doc.text(String(total), margin + contentW * 0.5 + 2, y + 4.5);
  doc.text("100%", margin + contentW * 0.75 + 2, y + 4.5);
  y += 10;

  if (pvSorted[0] && pct(pvSorted[0][1]) >= 50) {
    small(
      `Observación: El ${pct(pvSorted[0][1])}% de los incidentes se concentran en "${pvSorted[0][0]}", lo que sugiere que una parte importante de los registros puede corresponder a pruebas del sistema más que a operaciones reales en puntos de venta productivos.`
    );
  }

  // ── 4. Por Estado ──
  title("4. Distribución por Estado");
  const estados = [
    ["Pendiente", estadoMap.pendiente],
    ["En Proceso", estadoMap.en_proceso],
    ["Resuelto", estadoMap.resuelto],
  ];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setFillColor(37, 32, 126);
  doc.setTextColor(255, 255, 255);
  doc.rect(margin, y, contentW * 0.5, 7, "F");
  doc.rect(margin + contentW * 0.5, y, contentW * 0.25, 7, "F");
  doc.rect(margin + contentW * 0.75, y, contentW * 0.25, 7, "F");
  doc.text("Estado", margin + 2, y + 5);
  doc.text("Cantidad", margin + contentW * 0.5 + 2, y + 5);
  doc.text("%", margin + contentW * 0.75 + 2, y + 5);
  y += 7;

  estados.forEach(([name, count], i) => {
    checkPage(7);
    if (i % 2 === 0) {
      doc.setFillColor(238, 237, 248);
      doc.rect(margin, y, contentW, 6.5, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(String(name), margin + 2, y + 4.5);
    doc.text(String(count), margin + contentW * 0.5 + 2, y + 4.5);
    doc.text(`${pct(count as number)}%`, margin + contentW * 0.75 + 2, y + 4.5);
    y += 6.5;
  });
  y += 6;

  // ── 5. Por Agente ──
  title("5. Resumen por Técnico");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setFillColor(37, 32, 126);
  doc.setTextColor(255, 255, 255);
  const cols = [0.28, 0.12, 0.14, 0.14, 0.12, 0.2];
  let x = margin;
  ["Técnico", "Pend.", "Proceso", "Res.", "Total", "T. Promedio"].forEach((h, i) => {
    doc.rect(x, y, contentW * cols[i], 7, "F");
    doc.text(h, x + 1.5, y + 5);
    x += contentW * cols[i];
  });
  y += 7;

  agRows.forEach((row, i) => {
    checkPage(7);
    if (i % 2 === 0) {
      doc.setFillColor(238, 237, 248);
      doc.rect(margin, y, contentW, 6.5, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(40, 40, 40);
    x = margin;
    const vals = [
      row.ag,
      String(row.p),
      String(row.ep),
      String(row.r),
      String(row.total),
      row.prom !== null ? fmtDuracion(Math.round(row.prom)) : "—",
    ];
    vals.forEach((v, j) => {
      doc.text(v, x + 1.5, y + 4.5);
      x += contentW * cols[j];
    });
    y += 6.5;
  });
  y += 4;

  // Análisis de agentes
  const mejorAgente = agRows
    .filter((a) => a.ag !== "Sin asignar" && a.prom !== null)
    .sort((a, b) => (a.prom! - b.prom!))[0];
  const sinAsignar = agRows.find((a) => a.ag === "Sin asignar");

  if (mejorAgente) {
    body(
      `Análisis: ${mejorAgente.ag} presenta el mejor tiempo promedio de resolución (${fmtDuracion(Math.round(mejorAgente.prom!))}), atendiendo ${mejorAgente.total} incidentes.`
    );
  }
  if (sinAsignar) {
    body(
      `Sin asignar concentra la mayor carga (${sinAsignar.total} incidentes, ${pct(sinAsignar.total)}%), incluyendo ${sinAsignar.p} pendientes y ${sinAsignar.ep} en proceso${sinAsignar.prom !== null ? `, con un tiempo promedio de ${fmtDuracion(Math.round(sinAsignar.prom))}` : ""}.`
    );
  }

  // ── 6. Evolución Diaria ──
  title("6. Evolución Diaria");
  if (areaData.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setFillColor(37, 32, 126);
    doc.setTextColor(255, 255, 255);
    const evoCols = [0.25, 0.18, 0.18, 0.18, 0.21];
    x = margin;
    ["Fecha", "Creados", "Resueltos", "Netos", "Acumulado"].forEach((h, i) => {
      doc.rect(x, y, contentW * evoCols[i], 7, "F");
      doc.text(h, x + 1.5, y + 5);
      x += contentW * evoCols[i];
    });
    y += 7;

    let running = 0;
    areaData.forEach((d, i) => {
      checkPage(7);
      const netos = d.trafico - d.conversiones;
      running += netos;
      if (i % 2 === 0) {
        doc.setFillColor(238, 237, 248);
        doc.rect(margin, y, contentW, 6.5, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(40, 40, 40);
      x = margin;
      [d.name, String(d.trafico), String(d.conversiones), String(netos), String(running)].forEach((v, j) => {
        doc.text(v, x + 1.5, y + 4.5);
        x += contentW * evoCols[j];
      });
      y += 6.5;
    });
    y += 4;

    body(
      `El acumulado neto final del período es de ${sumCreated - sumResolved} incidentes (${sumCreated} creados – ${sumResolved} resueltos).`
    );
  }

  // ── 7. Análisis de Tiempos ──
  title("7. Análisis de Tiempos de Resolución");
  body(
    `Ticket más rápido: ${fmtDuracion(Math.round(tiempoMin))}. Ticket más lento: ${fmtDuracion(Math.round(tiempoMax))}. Tiempo promedio global: ${fmtDuracion(Math.round(tiempoProm))}.`
  );
  body(
    `Se observa dispersión en los tiempos de resolución. Los tickets sin técnico asignado y los asociados a puntos de prueba tienden a presentar tiempos significativamente mayores, mientras que los atendidos por técnicos activos se resuelven más rápido.`
  );

  // ── 8. Alertas y Recomendaciones ──
  title("8. Alertas y Recomendaciones");

  if (pvSorted[0] && pct(pvSorted[0][1]) >= 50) {
    body(
      `• Alta concentración en "${pvSorted[0][0]}" (${pct(pvSorted[0][1])}%): Se recomienda depurar los registros de prueba para obtener métricas más representativas de la operación real.`
    );
  }
  body(
    `• Tasa de resolución del ${pct(estadoMap.resuelto)}%: Un ${100 - pct(estadoMap.resuelto)}% de los incidentes (${estadoMap.pendiente + estadoMap.en_proceso}) no han sido cerrados. Se sugiere priorizar la asignación de los ${estadoMap.pendiente} pendientes y dar seguimiento a los ${estadoMap.en_proceso} en proceso.`
  );
  if (sinAsignar && sinAsignar.total > total * 0.3) {
    body(
      `• Incidentes sin asignar (${sinAsignar.total} de ${total}): El ${pct(sinAsignar.total)}% de los incidentes no tienen técnico asignado, lo que impacta directamente en los tiempos de resolución. Se recomienda implementar un flujo de asignación automática o manual oportuna.`
    );
  }
  body(
    `• Documentación de soluciones: El ${estadoMap.resuelto ? Math.round((resueltosConSolucion / estadoMap.resuelto) * 100) : 0}% de los tickets resueltos cuentan con descripción de solución, lo cual es positivo para la trazabilidad.`
  );

  // ── 9. Conclusión ──
  title("9. Conclusión");
  body(
    `El período analizado muestra un volumen de ${total} incidentes con una tasa de resolución del ${pct(estadoMap.resuelto)}%. ${pvSorted[0] && pct(pvSorted[0][1]) >= 50 ? `La operación se concentra en "${pvSorted[0][0]}" (${pct(pvSorted[0][1])}%), lo que puede distorsionar la lectura de los indicadores operativos reales. ` : ""}El acumulado neto de ${sumCreated - sumResolved} incidentes sin resolver al cierre del período${sinAsignar && sinAsignar.total > total * 0.3 ? `, junto con el alto porcentaje de incidentes sin asignar (${pct(sinAsignar.total)}%)` : ""}, representa el principal riesgo operativo. Se recomienda enfocar esfuerzos en la asignación oportuna de incidentes, la depuración de datos de prueba y el seguimiento a los tiempos de resolución.`
  );

  // Pie
  y += 6;
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 6;
  small(
    `Informe generado a partir de los datos del período ${formatDateRange(effectiveRange.start, effectiveRange.end)}. Fuente: HUB Platform.`
  );

  // Guardar
  const suffix = `_${effectiveRange.start}_${effectiveRange.end}`;
  doc.save(`informe_analitica_hub${suffix}.pdf`);
}
// ─────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────

export default memo(function AnalyticsFilters(props: AnalyticsFiltersProps) {
  const {
    filter,
    showDatePicker,
    startDate,
    endDate,
    metrics,
    areaData,
    donutData,
    appliedRange,
    onFilterChange,
    onStartChange,
    onEndChange,
    onApplyRange,
    onCancelRange,
    selectedAgente,
  } = props;

  const [exportingPdf, setExportingPdf] = useState(false);

  const presets: { key: FilterPreset; label: string }[] = [
    { key: "today", label: "Hoy" },
    { key: "week", label: "Esta Semana" },
    { key: "month", label: "Este Mes" },
    { key: "30d", label: "Últimos 30 Días" },
    { key: "custom", label: "Rango" },
  ];

  const onExportPdf = async () => {
    setExportingPdf(true);
    try {
      await handleExportPDF(appliedRange, filter, areaData, selectedAgente);
    } catch (err) {
      console.error("Error generando PDF", err);
      alert("No se pudo generar el PDF. Revisa la consola.");
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="relative">
      <div className="flex gap-3 items-center flex-wrap">
        <div className="flex items-center h-11 bg-[#E9E6FF] rounded-xl p-[3px]">
          {presets.map((p) => (
            <button
              key={p.key}
              onClick={() => onFilterChange(p.key)}
              className={`h-[38px] rounded-[10px] border-none cursor-pointer font-inter text-[13px] font-semibold transition-all duration-150 px-3 ${
                filter === p.key
                  ? "bg-white text-[#25207E] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  : "bg-transparent text-gray-500"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => handleExport(metrics, areaData, donutData, appliedRange, filter, selectedAgente)}
          className="flex items-center gap-2 h-11 px-[18px] bg-[#25207E] border-none rounded-[10px] cursor-pointer font-inter text-[13px] font-semibold text-white shadow-[0_4px_12px_rgba(37,32,126,0.2)]"
        >
          <Download size={16} strokeWidth={2.5} />
          Exportar Excel
        </button>

        <button
          onClick={onExportPdf}
          disabled={exportingPdf}
          className="flex items-center gap-2 h-11 px-[18px] bg-[#EF4444] border-none rounded-[10px] cursor-pointer font-inter text-[13px] font-semibold text-white shadow-[0_4px_12px_rgba(239,68,68,0.2)] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {exportingPdf ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <FileText size={16} strokeWidth={2.5} />
          )}
          {exportingPdf ? "Generando..." : "Exportar PDF"}
        </button>
      </div>

      {showDatePicker && (
        <div className="absolute top-14 right-0 z-50">
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartChange={onStartChange}
            onEndChange={onEndChange}
            onApply={onApplyRange}
            onCancel={onCancelRange}
          />
        </div>
      )}
    </div>
  );
});