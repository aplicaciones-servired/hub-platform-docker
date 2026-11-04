import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ticket, ArrowRight, CircleCheck } from "lucide-react-native";
import AppHeader from "../components/AppHeader";
import ExpandableMenu from "../components/ExpandableMenu";
import FaqModal from "../components/FaqModal";
import BottomTab from "../components/BottomTab";
import { api } from "../services/api";
import { logger } from "../services/logger";
import { useAuth } from "../contexts/AuthContext";
import { CATEGORIAS, getCategoriaLabel } from "../constants/categorias";
import { ESTADO_LABELS, ESTADO_COLORS } from "../constants/colors";
import { formatTicketId, formatDate } from "../lib/format";

// Último reporte del usuario (lo que se muestra en la tarjeta)
interface UltimoReporte {
  id: string;
  descripcion: string;
  estado: string;
  categoria?: string | null;
  created_at: string;
}

// Aviso del sistema: por ejemplo "Tu ticket #TK-... ha sido marcado como Resuelto"
interface Aviso {
  id: string;
  texto: string;
  fecha: string;
  ticketId: string;
}

// Estilo de las tarjetas blancas de esta pantalla
const tarjeta = {
  backgroundColor: "#FFFFFF",
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "#E5E7EB",
  padding: 16,
  marginBottom: 16,
};

// Estilo de los títulos de cada sección
const tituloSeccion = {
  fontSize: 17,
  color: "#1F2366",
  fontFamily: "Inter_700Bold",
  fontWeight: "700" as const,
  marginBottom: 4,
};

export default function InicioScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, initializing } = useAuth();

  const [showFaq, setShowFaq] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [ultimoReporte, setUltimoReporte] = useState<UltimoReporte | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);

  // Al abrir la pantalla: si no hay sesión, vuelve al login; si hay, carga los datos
  useEffect(() => {
    if (initializing) return;
    if (!user) {
      router.replace("/");
      return;
    }

    // 1. El último reporte que envió el usuario
    const pedirUltimoReporte = api
      .get<{ items: UltimoReporte[] }>("/incidents?limit=1")
      .then((data) => setUltimoReporte(data.items[0] ?? null))
      .catch((err) => {
        logger.error("Inicio: error cargando ultimo reporte", { error: (err as Error).message });
      });

    // 2. Los avisos del sistema (mensajes del bot que hablan de un ticket)
    const pedirAvisos = api
      .get<{
        items: {
          id: string;
          content: string;
          is_bot: boolean;
          created_at: string;
          metadata?: { ticketId?: string } | null;
        }[];
      }>("/chat/history?limit=30")
      .then((data) => {
        const lista: Aviso[] = (data.items ?? [])
          .filter((msg) => msg.is_bot && msg.metadata?.ticketId)
          .map((msg) => ({
            id: msg.id,
            texto: msg.content
              .replace(/\*\*/g, "") // quita los ** del texto
              .replace("Si necesita mas ayuda, contactenos.", "") // frase de avisos viejos
              .trim(), // quita los espacios y saltos de línea que sobran al final
            fecha: msg.created_at,
            ticketId: msg.metadata!.ticketId!,
          }))
          .reverse() // el más reciente primero
          .slice(0, 3); // solo los 3 últimos
        setAvisos(lista);
      })
      .catch((err) => {
        logger.error("Inicio: error cargando avisos", { error: (err as Error).message });
      });

    Promise.all([pedirUltimoReporte, pedirAvisos]).finally(() => setCargando(false));
  }, [initializing, user, router]);

  // Botones que despliega "Reportar incidente": abren el formulario con el tipo elegido
  const handleSubmenuPress = useCallback(
    (label: string) => {
      const categoria = CATEGORIAS.find((c) => c.label === label);
      if (categoria) {
        router.push({ pathname: "/reportar", params: { categoria: categoria.codigo } });
      }
    },
    [router]
  );

  // Botones sin submenú: "Preguntas frecuentes"
  const handleMenuPress = useCallback((label: string) => {
    if (label === "Preguntas frecuentes") setShowFaq(true);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F6FA" }}>
      <AppHeader
        title="Centro de soporte"
        subtitle="¿Qué necesitas hacer? Toca una opción"
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* SECCIÓN 1: el menú de opciones */}
        <View style={tarjeta}>
          <Text style={tituloSeccion}>¿En qué te podemos ayudar?</Text>
          <Text style={{ fontSize: 14, color: "#6B7280", fontFamily: "Inter_400Regular" }}>
            Toca "Reportar incidente" para ver los tipos de problema.
          </Text>
          <ExpandableMenu
            onSubmenuPress={handleSubmenuPress}
            onMenuPress={handleMenuPress}
          />
        </View>

        {cargando ? (
          <ActivityIndicator size="large" color="#3B348B" style={{ marginTop: 16 }} />
        ) : (
          <>
            {/* SECCIÓN 2: el último reporte */}
            {ultimoReporte ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => router.push(`/incidente/${ultimoReporte.id}`)}
                style={tarjeta}
              >
                <Text style={tituloSeccion}>Tu último reporte</Text>

                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                  <Ticket size={18} color="#25207E" strokeWidth={2} />
                  <Text style={{ fontSize: 15, color: "#25207E", fontFamily: "Inter_700Bold" }}>
                    {formatTicketId(ultimoReporte.id)}
                  </Text>
                  <View
                    style={{
                      backgroundColor: ESTADO_COLORS[ultimoReporte.estado] ?? "#6B7280",
                      borderRadius: 999,
                      paddingHorizontal: 10,
                      paddingVertical: 3,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: "#FFFFFF", fontFamily: "Inter_700Bold" }}>
                      {ESTADO_LABELS[ultimoReporte.estado] ?? ultimoReporte.estado}
                    </Text>
                  </View>
                </View>

                {ultimoReporte.categoria ? (
                  <Text style={{ fontSize: 14, color: "#1F2366", fontFamily: "Inter_700Bold", marginTop: 8 }}>
                    {getCategoriaLabel(ultimoReporte.categoria)}
                  </Text>
                ) : null}

                <Text
                  numberOfLines={2}
                  style={{ fontSize: 15, color: "#1F2937", fontFamily: "Inter_400Regular", marginTop: 4 }}
                >
                  {ultimoReporte.descripcion}
                </Text>

                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10 }}>
                  <Text style={{ flex: 1, fontSize: 13, color: "#6B7280", fontFamily: "Inter_400Regular" }}>
                    {formatDate(ultimoReporte.created_at)}
                  </Text>
                  <Text style={{ fontSize: 14, color: "#25207E", fontFamily: "Inter_700Bold", marginRight: 4 }}>
                    Ver detalle
                  </Text>
                  <ArrowRight size={16} color="#25207E" strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
            ) : null}

            {/* SECCIÓN 3: avisos del sistema (reportes resueltos, etc.) */}
            {avisos.length > 0 ? (
              <View style={tarjeta}>
                <Text style={[tituloSeccion, { marginBottom: 10 }]}>Avisos</Text>

                {avisos.map((aviso, index) => (
                  <TouchableOpacity
                    key={aviso.id}
                    activeOpacity={0.7}
                    onPress={() => router.push(`/incidente/${aviso.ticketId}`)}
                    style={{
                      flexDirection: "row",
                      gap: 10,
                      paddingVertical: 10,
                      borderTopWidth: index > 0 ? 1 : 0,
                      borderTopColor: "#F3F4F6",
                    }}
                  >
                    <CircleCheck size={20} color="#22C55E" strokeWidth={2} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, color: "#1F2937", fontFamily: "Inter_400Regular", lineHeight: 20 }}>
                        {aviso.texto}
                      </Text>
                      <Text style={{ fontSize: 12, color: "#9CA3AF", fontFamily: "Inter_400Regular", marginTop: 4 }}>
                        {formatDate(aviso.fecha)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Ventana de preguntas frecuentes */}
      <Modal
        visible={showFaq}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFaq(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <FaqModal onClose={() => setShowFaq(false)} />
        </View>
      </Modal>

      <BottomTab
        activeTab="chatbot"
        safeBottom={insets.bottom + 4}
        onTabChange={(tab) => {
          if (tab === "reportar") router.push("/reportar");
          if (tab === "historial") router.push("/historial");
          if (tab === "capacitacion") router.push("/capacitacion");
        }}
      />
    </View>
  );
}