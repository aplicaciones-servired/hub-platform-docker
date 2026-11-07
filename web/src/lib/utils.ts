import type { ApiUser } from "@hub/shared/types/user";

export function isAdminRole(rol: string | null | undefined): boolean {
  return rol === "admin" || rol === "tecnico";
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Fecha no disponible";
  return d.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Fecha no disponible";
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateOnly(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Fecha no disponible";
  return d.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "Rango de fechas inválido";
  const fmt = (d: Date) =>
    d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt(s)} – ${fmt(e)}`;
}

export const ESTADO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  en_proceso: "En Proceso",
  resuelto: "Resuelto",
};

export const ESTADO_COLORS: Record<string, string> = {
  pendiente: "#3B82F6",
  en_proceso: "#F59E0B",
  resuelto: "#22C55E",
};

export function formatTicketId(id: string): string {
  const short = id.replace(/-/g, "").slice(-8).toUpperCase();
  return `#TK-${short}`;
}

export function formatDescription(desc: string): string {
  return desc.length > 50 ? desc.slice(0, 50) + "..." : desc;
}

export function getDateRange(filter: string): { start: string; end: string } {
  const now = new Date();
  const end = toDateKey(now);
  let start: string;
  switch (filter) {
    case "today":
      start = end;
      break;
    case "week": {
      const monday = new Date(now);
      const day = monday.getDay();
      const diff = day === 0 ? 6 : day - 1;
      monday.setDate(monday.getDate() - diff);
      start = toDateKey(monday);
      break;
    }
    case "month": {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      start = toDateKey(first);
      break;
    }
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      start = toDateKey(d);
      break;
    }
    case "30d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      start = toDateKey(d);
      break;
    }
    case "90d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 90);
      start = toDateKey(d);
      break;
    }
    default: {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      start = toDateKey(d);
      break;
    }
  }
  return { start, end };
}

export function getCacheStats() {
  if (typeof localStorage === "undefined") return { items: 0, size: "0 KB", lsItems: 0, ssItems: 0 };
  const lsItems = localStorage.length || 0;
  const ssItems = typeof sessionStorage !== "undefined" ? sessionStorage.length || 0 : 0;
  let totalBytes = 0;
  if (lsItems) {
    for (let i = 0; i < lsItems; i++) {
      const key = localStorage.key(i);
      if (key) {
        totalBytes += key.length * 2;
        totalBytes += (localStorage.getItem(key)?.length || 0) * 2;
      }
    }
  }
  const size = totalBytes < 1024
    ? `${totalBytes} B`
    : totalBytes < 1048576
      ? `${(totalBytes / 1024).toFixed(1)} KB`
      : `${(totalBytes / 1048576).toFixed(1)} MB`;
  return { items: lsItems + ssItems, size, lsItems, ssItems };
}


// ── User helper functions (extracted from UserManagement.tsx / UsersTable.tsx) ──

export function hasName(user: ApiUser): boolean {
  return user.nombre !== user.documento;
}

export function displayName(user: ApiUser): string {
  return hasName(user) ? user.nombre : user.documento;
}

export function getInitials(user: ApiUser): string {
  const name = hasName(user) ? user.nombre : user.documento;
  return name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
