// Tipos de incidente que puede elegir el punto de venta.
// "codigo" es lo que se guarda en la base de datos (no cambiarlo nunca).
// "label" es el texto que ve la persona (se puede cambiar sin problema).
export const CATEGORIAS = [
  { codigo: "aplicativos", label: "Problema aplicativos (SIS, SuperFlex, Bnet...)", tiempo: "30 minutos" },
  { codigo: "bloqueo_usuario", label: "Problema bloqueo de usuario / activación", tiempo: "30 minutos" },
  { codigo: "internet_vpn", label: "Problema falla de internet / VPN", tiempo: "1 hora" },
  { codigo: "impresoras_pda", label: "Problema impresoras / máquinas PDA", tiempo: "1 hora" },
  { codigo: "baterias", label: "Problema baterías", tiempo: "3 horas" },
  { codigo: "energia", label: "Problema energía", tiempo: "3 horas" },
  { codigo: "otro", label: "Otro problema", tiempo: "" },
];

// Busca el texto visible a partir del código: "energia" -> "Problema energía"
export function getCategoriaLabel(codigo?: string): string {
  return CATEGORIAS.find((c) => c.codigo === codigo)?.label ?? "Sin tipo";
}