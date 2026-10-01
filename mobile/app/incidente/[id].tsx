import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Clock, User, Phone, MapPin, AlertCircle, Shield, MessageSquare, XCircle } from "lucide-react-native";
import { api } from "../../src/services/api";
import { URGENCIA_COLORS, ESTADO_LABELS, ESTADO_COLORS, COLORS } from "../../src/constants/colors";
import { formatTicketId, formatDate } from "../../src/lib/format";

interface IncidentDetail {
  id: string;
  nombre: string;
  documento: string;
  telefono: string;
  punto_venta: string;
  descripcion: string;
  urgencia: "baja" | "media" | "alta";
  estado: "pendiente" | "en_proceso" | "resuelto";
  agente: string | null;
  created_at: string;
  updated_at: string;
  comments: { id: string; autor: string; texto: string; fecha: string }[];
}

export default function IncidentDetailScreen() {
  const insets = useSafeAreaInsets();
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
      <View
        style={{ paddingTop: insets.top }}
        className="flex-1 bg-[#F5F5F5]"
      >
        <View className="flex-row items-center px-5 py-4 border-b border-gray-200 bg-white">
          <TouchableOpacity onPress={goBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ArrowLeft size={22} color="#1F2366" strokeWidth={2} />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-[#1F2366] font-inter ml-4">
            {error ? "Error" : "Incidente no encontrado"}
          </Text>
        </View>
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
  const urgencyColor = URGENCIA_COLORS[incident.urgencia];

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      {/* Header */}
      <View
        style={{ paddingTop: insets.top }}
        className="bg-white border-b border-gray-200"
      >
        <View className="flex-row items-center px-5 py-4">
          <TouchableOpacity onPress={goBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ArrowLeft size={22} color="#1F2366" strokeWidth={2} />
          </TouchableOpacity>
          <Text className="text-lg font-bold text-[#1F2366] font-inter ml-4">
            Detalle del Ticket
          </Text>
        </View>
      </View>

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
              style={{ backgroundColor: urgencyColor }}
            >
              <Text className="text-[11px] font-bold text-white font-inter">
                {incident.urgencia.toUpperCase()}
              </Text>
            </View>
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
          <InfoRow icon={User} label="Solicitante" value={incident.nombre} />
          <InfoRow icon={User} label="Documento" value={incident.documento} />
          <InfoRow icon={Phone} label="Teléfono" value={incident.telefono || "—"} />
          <InfoRow icon={MapPin} label="Punto de Venta" value={incident.punto_venta} />
          <InfoRow icon={AlertCircle} label="Urgencia" value={incident.urgencia.charAt(0).toUpperCase() + incident.urgencia.slice(1)} />
          <InfoRow icon={Clock} label="Estado" value={status} />
          <InfoRow icon={Shield} label="Agente" value={incident.agente || "Sin asignar"} />
        </View>

        {/* Comments */}
        {incident.comments.length > 0 && (
          <View className="bg-white rounded-2xl border border-gray-200 p-5">
            <Text className="text-base font-bold text-[#1F2937] font-inter mb-3">
              Comentarios
            </Text>
            {incident.comments.map((comment) => (
              <View key={comment.id} className="border-b border-gray-100 pb-3 mb-3">
                <View className="flex-row items-center gap-2 mb-1">
                  <MessageSquare size={14} color="#6B7280" />
                  <Text className="text-[13px] font-semibold text-[#374151] font-inter">
                    {comment.autor}
                  </Text>
                  <Text className="text-[11px] text-[#9CA3AF] font-inter">
                    {formatDate(comment.fecha)}
                  </Text>
                </View>
                <Text className="text-sm text-[#6B7280] font-inter ml-6">
                  {comment.texto}
                </Text>
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
