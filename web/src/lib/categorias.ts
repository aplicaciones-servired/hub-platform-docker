// Tipos de incidente. Deben coincidir con mobile/src/constants/categorias.ts
// y con CATEGORIAS_INCIDENTE del backend.
export const CATEGORIAS = [
  { codigo: "aplicativos", label: "Aplicativos (SIS, SuperFlex, Bnet...)", tiempo: "30 min" },
  { codigo: "bloqueo_usuario", label: "Bloqueo de usuario / activación", tiempo: "30 min" },
  { codigo: "internet_vpn", label: "Internet / VPN", tiempo: "1 hora" },
  { codigo: "impresoras_pda", label: "Impresoras / máquinas PDA", tiempo: "1 hora" },
  { codigo: "baterias", label: "Baterías", tiempo: "3 horas" },
  { codigo: "energia", label: "Energía", tiempo: "3 horas" },
  { codigo: "otro", label: "Otro problema", tiempo: "" },
];

export function getCategoriaLabel(codigo?: string | null): string {
  return CATEGORIAS.find((c) => c.codigo === codigo)?.label ?? "Sin tipo";
}