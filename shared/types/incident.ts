export type IncidentUrgency = "baja" | "media" | "alta";
export type IncidentStatus = "pendiente" | "en_proceso" | "resuelto";

export interface Incident {
  id: string;
  user_id: string;
  nombre: string;
  documento: string;
  punto_venta: string;
  telefono: string;
  descripcion: string;
  urgencia: IncidentUrgency;
  estado: IncidentStatus;
  agente: string | null;
  tecnico_id?: string | null;
  solucion: string | null;
  imagen_url: string | null;
  cerrado_por: string | null;
  cerrado_por_nombre: string | null;
  fecha_cierre: string | null;
  created_at: string;
  updated_at: string;
  comments?: IncidentComment[];
}

export interface IncidentComment {
  id: string;
  incident_id: string;
  autor: string;
  texto: string;
  fecha: string;
}

export interface CreateIncidentInput {
  nombre: string;
  documento: string;
  punto_venta: string;
  telefono?: string;
  descripcion: string;
  urgencia?: IncidentUrgency;
}

export interface UpdateIncidentInput {
  estado?: IncidentStatus;
  agente?: string;
  tecnico_id?: string | null;
  solucion?: string;
  imagen_url?: string | null;
}
