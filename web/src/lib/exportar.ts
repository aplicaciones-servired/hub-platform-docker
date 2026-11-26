import { api } from "@/lib/api";

// Trae TODOS los tickets de una exportación pidiéndolos por páginas.
// Antes se pedían en una sola petición (limit=2000, o 1000 en la pantalla Tickets)
// y, si el rango tenía más, el reporte salía incompleto sin avisar.
// La API no acepta más de 2000 por petición, para no llenar su memoria,
// así que se piden de 500 en 500.
const POR_PAGINA = 500;
const MAX_PAGINAS = 200; // Tope de seguridad: 100.000 tickets

interface RespuestaExportacion<T> {
  items: T[];
  totalPages?: number;
}

export async function obtenerTicketsExportacion<T extends { id: string }>(
  params: Record<string, string | undefined>
): Promise<T[]> {
  const porId = new Map<string, T>();
  let pagina = 1;
  let totalPaginas = 1;

  do {
    const qs = new URLSearchParams();
    for (const [clave, valor] of Object.entries(params)) {
      if (valor) qs.set(clave, valor);
    }
    qs.set("limit", String(POR_PAGINA));
    qs.set("page", String(pagina));

    const data = await api.get<RespuestaExportacion<T>>(`/incidents/export-data?${qs.toString()}`);
    const items = data.items || [];

    // Si entra un ticket nuevo mientras se exporta, uno puede llegar en dos páginas:
    // se guarda por id para no repetirlo
    for (const item of items) porId.set(item.id, item);

    // Si la API no dice cuántas páginas hay, se sigue mientras lleguen páginas llenas
    totalPaginas = data.totalPages ?? (items.length === POR_PAGINA ? pagina + 1 : pagina);
    pagina++;
  } while (pagina <= totalPaginas && pagina <= MAX_PAGINAS);

  return Array.from(porId.values());
}