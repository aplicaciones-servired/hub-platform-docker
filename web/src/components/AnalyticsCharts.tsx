"use client";

import { memo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { useTheme } from "@/contexts/ThemeContext";

export interface AreaDataPoint {
  name: string;
  trafico: number;
  conversiones: number;
}

export interface DonutDataPoint {
  name: string;
  value: number;
  color: string;
}

export interface StatusBarDataPoint {
  name: string;
  pendientes: number;
  enProceso: number;
  resueltos: number;
}

interface TrafficChartProps {
  data: AreaDataPoint[];
}

export const TrafficChart = memo(function TrafficChart({ data }: TrafficChartProps) {
  const { theme } = useTheme();
  const tickFill = theme === "dark" ? "#f3f4f6" : "#9CA3AF";
  const gridStroke = theme === "dark" ? "#374151" : "#F3F4F6";
  const tooltipBg = theme === "dark" ? "#1e293b" : "#FFFFFF";
  const tooltipColor = theme === "dark" ? "#e2e8f0" : undefined;

  const minWidth = 80;
  const chartWidth = Math.max(data.length * minWidth, 400);

  return (
    <div style={{ overflowX: "auto", height: 280 }}>
      <div style={{ width: chartWidth, height: "100%", minWidth: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorTrafico" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#25207E" stopOpacity={0.12} />
                <stop offset="95%" stopColor="#25207E" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorConvs" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#A1A1AA" stopOpacity={0.08} />
                <stop offset="95%" stopColor="#A1A1AA" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: tickFill }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: tickFill }} axisLine={false} tickLine={false} width={50} />
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #E5E7EB",
                boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
                backgroundColor: tooltipBg,
                color: tooltipColor,
              }}
            />
            <Area type="monotone" dataKey="trafico" stroke="#25207E" strokeWidth={2.5} fill="url(#colorTrafico)" />
            <Area type="monotone" dataKey="conversiones" stroke="#A1A1AA" strokeWidth={2.5} fill="url(#colorConvs)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
});

interface DonutChartProps {
  data: DonutDataPoint[];
  allPvNames?: string[];
}

export const DonutChart = memo(function DonutChart({ data, allPvNames }: DonutChartProps) {
  const { theme } = useTheme();
  const safeData = Array.isArray(data) ? data : [];
  const tooltipBg = theme === "dark" ? "#1e293b" : "#FFFFFF";
  const tooltipColor = theme === "dark" ? "#e2e8f0" : undefined;

  const pvColorMap = new Map(safeData.map((d) => [d.name, d.color]));
  const pvValueMap = new Map(safeData.map((d) => [d.name, d.value]));
  const allPvs = allPvNames || [];
    const colors = ["#25207E", "#3B348B", "#1E40AF", "#2563EB", "#3B82F6", "#0EA5E9", "#60A5FA", "#93C5FD"];

  return (
    <div className="flex flex-col items-center gap-5">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={safeData}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={100}
            paddingAngle={4}
            dataKey="value"
            strokeWidth={0}
          >
            {safeData.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #E5E7EB",
              boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
              backgroundColor: tooltipBg,
              color: tooltipColor,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="w-full max-h-40 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {allPvs.map((name, i) => {
            const hasData = pvColorMap.has(name);
            const color = hasData ? (pvColorMap.get(name) || colors[i % colors.length]) : "#E5E7EB";
            const valor = hasData ? pvValueMap.get(name) : 0;
            return (
              <div key={name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="text-[11px] truncate font-inter text-gray-500 dark:text-gray-400">
                  {name}
                </span>
                <span className={`text-[11px] shrink-0 font-inter text-gray-300 ${hasData ? "font-semibold" : "font-normal"}`} style={{ color: hasData ? color : undefined }}>
                  {hasData ? `${valor}%` : "0%"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

interface StatusBarChartProps {
  data: StatusBarDataPoint[];
}

export const StatusBarChart = memo(function StatusBarChart({ data }: StatusBarChartProps) {
  const { theme } = useTheme();
  const safeData = Array.isArray(data) ? data : [];
  const tickFill = theme === "dark" ? "#f3f4f6" : "#9CA3AF";
  const gridStroke = theme === "dark" ? "#374151" : "#F3F4F6";
  const tooltipBg = theme === "dark" ? "#1e293b" : "#FFFFFF";
  const tooltipColor = theme === "dark" ? "#e2e8f0" : undefined;

  if (safeData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[280px]">
        <span className="text-[14px] text-gray-400 dark:text-gray-500 font-inter">
          Sin datos
        </span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={safeData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: tickFill }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: tickFill }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #E5E7EB",
            boxShadow: "0 4px 12px rgba(0,0,0,0.06)",
            backgroundColor: tooltipBg,
            color: tooltipColor,
          }}
        />
        <Bar dataKey="pendientes" name="Pendientes" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={60} />
        <Bar dataKey="enProceso" name="En Proceso" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={60} />
        <Bar dataKey="resueltos" name="Resueltos" fill="#22C55E" radius={[4, 4, 0, 0]} maxBarSize={60} />
      </BarChart>
    </ResponsiveContainer>
  );
});
// ────────────────────────────────────────
// GRÁFICA: Horas Pico
// ────────────────────────────────────────
export interface HoraDataPoint {
  name: string;
  total: number;
}

interface HorasPicoChartProps {
  data: HoraDataPoint[];
}

export const HorasPicoChart = memo(function HorasPicoChart({ data }: HorasPicoChartProps) {
  const { theme } = useTheme();
  const safeData = Array.isArray(data) ? data : [];
  const tickFill = theme === "dark" ? "#f3f4f6" : "#9CA3AF";
  const gridStroke = theme === "dark" ? "#374151" : "#F3F4F6";
  const tooltipBg = theme === "dark" ? "#1e293b" : "#FFFFFF";
  const tooltipColor = theme === "dark" ? "#e2e8f0" : undefined;

  const filtered = safeData.filter((d) => d.total > 0);
  const maxTotal = Math.max(...filtered.map((d) => d.total), 1);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={filtered} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: tickFill }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: tickFill }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #E5E7EB",
            backgroundColor: tooltipBg,
            color: tooltipColor,
          }}
        />
        <Bar dataKey="total" name="Tickets" radius={[6, 6, 0, 0]} maxBarSize={40}>
          {filtered.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.total >= maxTotal * 0.7 ? "#25207E" : entry.total >= maxTotal * 0.4 ? "#3B82F6" : "#93C5FD"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

// ────────────────────────────────────────
// GRÁFICA: Tickets por Técnico (Pie Chart)
// ────────────────────────────────────────
export interface TecnicoDataPoint {
  name: string;
  value: number;
}

interface TecnicoPieChartProps {
  data: TecnicoDataPoint[];
}

export const TecnicoPieChart = memo(function TecnicoPieChart({ data }: TecnicoPieChartProps) {
  const { theme } = useTheme();
  const safeData = Array.isArray(data) ? data : [];
  const tooltipBg = theme === "dark" ? "#1e293b" : "#FFFFFF";
  const tooltipColor = theme === "dark" ? "#e2e8f0" : undefined;

  const colors = ["#25207E", "#3B348B", "#1E40AF", "#2563EB", "#3B82F6", "#0EA5E9", "#60A5FA", "#93C5FD"];
  const total = safeData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex flex-col items-center gap-5">
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={safeData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
            label={({ name, value }) => `${name}: ${value}`}
          >
            {safeData.map((entry, index) => (
              <Cell key={index} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #E5E7EB",
              backgroundColor: tooltipBg,
              color: tooltipColor,
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="w-full max-h-40 overflow-y-auto">
        <div className="flex flex-col gap-0.5">
          {safeData.map((entry, i) => {
            const pct = total > 0 ? Math.round((entry.value / total) * 100) : 0;
            return (
              <div key={entry.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                <span className="text-[11px] truncate font-inter text-gray-500 dark:text-gray-400 flex-1">
                  {entry.name}
                </span>
                <span className="text-[11px] shrink-0 font-inter text-gray-300">
                  {entry.value} ({pct}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});