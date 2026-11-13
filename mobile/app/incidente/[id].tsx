import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Clock, User, Phone, MapPin, AlertCircle, Shield, MessageSquare, XCircle } from "lucide-react-native";
import { api } from "../../src/services/api";
import AppHeader from "../../src/components/AppHeader";
import IncidentPhoto from "../../src/components/IncidentPhoto";
import { ESTADO_LABELS, ESTADO_COLORS, COLORS } from "../../src/constants/colors";
import { getCategoriaLabel } from "../../src/constants/categorias";
import { formatTicketId, formatDate } from "../../src/lib/format";

interface IncidentDetail {
  id: string;
  nombre: string;
  documento: string;
  telefono: string;
  punto_venta: string;
  descripcion: string;
  categoria?: string | null;
    reportante_nombre?: string | null;
  reportante_cedula?: string | null;
  estado: "pendiente" | "en_proceso" | "resuelto";
  agente: string | null;
  created_at: string;
  updated_at: string;
  imagenes?: string[] | null; 
 comments: { 
    id: string; 
    autor: string; 
    texto: string; 
    fecha: string;
    edited_at?: string | null; 
  }[];
  
  
}

export default function IncidentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // `router.back()` es un no-op silencioso cuando el historial está vacío. Desde
  // la pantalla de éxito se llega con `router.replace` (exito.tsx), que sustituye
  // la entrada en vez de apilar, así que el botón Volver quedaba muerto en ese
  // camino. Desde historial se llega con `push` y ahí sí funciona; con este
  // fallback ambos caminos hacen algo.
  
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/historial");
    }
  };

  useEffect(() => {
    if (!id) {
      setError("No se recibió el identificador del ticket");
      setLoading(false);
      return;
    }
    api
      .get<IncidentDetail>(`/incidents/${id}`)
      .then(setIncident)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error al cargar el incidente");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#F5F5F5]">
        <ActivityIndicator size="large" color="#3B348B" />
      </View>
    );
  }

  if (!incident) {
    return (
        <View className="flex-1 bg-[#F5F5F5]">
        <AppHeader
          title={error ? "No se pudo cargar el reporte" : "Reporte no encontrado"}
          onBack={goBack}
        />
        {error && (
          <View className="flex-1 items-center justify-center px-8">
            <XCircle size={48} color="#EF4444" strokeWidth={1.5} />
            <Text className="text-base text-[#EF4444] font-inter text-center mt-4 leading-relaxed">
              {error}
            </Text>
            <TouchableOpacity
              onPress={goBack}
              className="mt-6 px-6 py-3 bg-[#3B348B] rounded-lg"
            >
              <Text className="text-white font-inter font-semibold">Volver</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }

  const status = ESTADO_LABELS[incident.estado];
  const statusColor = ESTADO_COLORS[incident.estado];

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      
      <AppHeader
        title="Detalle del Reporte"
        subtitle="Aquí ves toda la información del incidente que reportaste"
        onBack={goBack}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
      >
        {/* ID + Badges Card */}
        <View className="bg-white rounded-2xl border border-gray-200 p-5">
          <View className="flex-row items-center gap-3 mb-3">
            <Text className="text-lg font-bold text-[#25207E] font-inter">
              {formatTicketId(incident.id)}
            </Text>
            <View
              className="px-2.5 py-1 rounded-full"
              style={{ backgroundColor: statusColor }}
            >
              <Text className="text-[11px] font-bold text-white font-inter">
                {status}
              </Text>
            </View>
          </View>
          <Text className="text-base text-[#1F2937] font-inter leading-relaxed">
            {incident.descripcion}
          </Text>
        </View>

  
           {/* Info Grid */}
        <View className="bg-white rounded-2xl border border-gray-200 p-5 gap-4">
          {/* Nuevos campos del Solicitante */}
          <InfoRow icon={User} label="Nombre del Solicitante" value={(incident as any).reportante_nombre || "No registrado"} />
          <InfoRow icon={User} label="Cédula del Solicitante" value={(incident as any).reportante_cedula || "No registrado"} />

          {/* Campos del Punto de Venta y del Ticket */}
          <InfoRow icon={User} label="Usuario del Punto" value={incident.nombre} />
          <InfoRow icon={User} label="Código del punto" value={incident.documento} />
          <InfoRow icon={Phone} label="Teléfono" value={incident.telefono || "—"} />
          <InfoRow icon={MapPin} label="Punto de Venta" value={incident.punto_venta} />
          <InfoRow icon={AlertCircle} label="Tipo de problema" value={getCategoriaLabel(incident.categoria ?? undefined)} />
          <InfoRow icon={AlertCircle} label="Urgencia" value={incident.urgencia.charAt(0).toUpperCase() + incident.urgencia.slice(1)} />
          <InfoRow icon={Clock} label="Estado" value={status} />
          <InfoRow icon={Shield} label="Técnico asignado" value={incident.agente || "Sin asignar"} />
        </View>

            {/* FOTOS ADJUNTAS */}
        {incident.imagenes && incident.imagenes.length > 0 && (
          <View className="bg-white rounded-2xl border border-gray-200 p-5">
            <Text className="text-base font-bold text-[#1F2937] font-inter mb-3">
              Fotos adjuntas
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {incident.imagenes.map((imgKey: string, index: number) => {
                return (
                  <IncidentPhoto
                    key={index}
                    imageKey={imgKey}
                    style={{ width: 160, height: 160, borderRadius: 10, marginRight: 10, backgroundColor: "#F3F4F6" }}
                  />
                );
              })}
            </ScrollView>
          </View>
        )}
        {/* FIN FOTOS ADJUNTAS */}
          {/* HISTORIAL DE SEGUIMIENTO */}
        {incident.comments.length > 0 && (
          <View className="bg-white rounded-2xl border border-gray-200 p-5">
            <Text className="text-base font-bold text-[#1F2937] font-inter mb-4">
              Historial de Seguimiento
            </Text>
            {incident.comments.map((comment, index) => (
              <View key={comment.id} className="flex-row">
                {/* Línea de tiempo (ícono y línea vertical) */}
                <View className="items-center mr-3">
                  <View className="w-8 h-8 rounded-full bg-[#F3F0FF] items-center justify-center">
                    <User size={14} color="#25207E" strokeWidth={2} />
                  </View>
                  {index !== incident.comments.length - 1 && (
                    <View className="w-0.5 flex-1 bg-gray-200 my-1" style={{ minHeight: 20 }} />
                  )}
                </View>
                
                {/* Tarjeta del comentario */}
                <View className="flex-1 bg-gray-50 rounded-lg p-3 border border-gray-100 mb-4">
                <View className="flex-row justify-between items-start mb-1">
  <View className="flex-row items-center gap-2">
    <Text className="text-[13px] font-bold text-[#374151] font-inter">
      {comment.autor}
    </Text>
    {comment.edited_at && (
      <Text className="text-[9px] text-gray-400 italic font-inter">(editado)</Text>
    )}
  </View>
  <Text className="text-[10px] text-[#9CA3AF] font-inter">
    {formatDate(comment.fecha)}
  </Text>
</View>
                  <Text className="text-sm text-[#4B5563] font-inter leading-relaxed">
                    {comment.texto}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Timestamps */}
        <View className="bg-white rounded-2xl border border-gray-200 p-5">
          <View className="flex-row justify-between">
            <Text className="text-xs text-[#9CA3AF] font-inter">
              Creado: {formatDate(incident.created_at)}
            </Text>
            <Text className="text-xs text-[#9CA3AF] font-inter">
              Actualizado: {formatDate(incident.updated_at)}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="w-8 h-8 rounded-lg bg-[#F3F0FF] items-center justify-center">
        <Icon size={14} color="#25207E" strokeWidth={2} />
      </View>
      <View className="flex-1">
        <Text className="text-[11px] font-semibold text-[#9CA3AF] font-inter uppercase">
          {label}
        </Text>
        <Text className="text-sm font-medium text-[#1F2937] font-inter mt-0.5">
          {value}
        </Text>
      </View>
    </View>
  );
}
