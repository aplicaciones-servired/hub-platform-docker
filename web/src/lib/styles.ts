export const STATUS_BADGES: Record<string, string> = {
  pendiente: "bg-blue-500 text-white",
  en_proceso: "bg-purple-600 text-white",
  resuelto: "bg-green-500 text-white",
};

export const STATUS_DOTS: Record<string, string> = {
  Abierto: "bg-blue-500",
  Pendiente: "bg-blue-500",
  "En Proceso": "bg-amber-400",
  Resuelto: "bg-green-500",
};

export const STATUS_ACTION_COLORS: Record<string, string> = {
  pendiente: "text-blue-500",
  en_proceso: "text-purple-600",
  resuelto: "text-green-500",
};

export const ROLE_BADGES: Record<string, string> = {
  admin: "bg-[#25207E] text-white",
  tecnico: "bg-blue-700 text-white",
  asesor: "bg-amber-100 text-amber-600",
  user: "bg-[#DCCFFF] text-[#6D4AFF]",
};

export const URGENCIA_COLORS: Record<string, string> = {
  alta: "#EF4444",
  media: "#F59E0B",
  baja: "#22C55E",
};

export const ESTADO_BADGES: Record<string, { bg: string; text: string; dot: string }> = {
  activo: { bg: "bg-green-100", text: "text-green-600", dot: "bg-green-500" },
  bloqueado: { bg: "bg-red-100", text: "text-red-600", dot: "bg-red-500" },
};
