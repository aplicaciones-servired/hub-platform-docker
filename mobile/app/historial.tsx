import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { History, AlertCircle } from "lucide-react-native";
import { api } from "../src/services/api";
import BottomTab from "../src/components/BottomTab";
import AppHeader from "../src/components/AppHeader";
import { URGENCIA_COLORS, ESTADO_LABELS, ESTADO_COLORS, COLORS } from "../src/constants/colors";

interface Incident {
  id: string;
  nombre: string;
  punto_venta: string;
  descripcion: string;
  urgencia: "baja" | "media" | "alta";
  estado: "pendiente" | "en_proceso" | "resuelto";
  created_at: string;
}

interface IncidentsResponse {
  items: Incident[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const LIMIT = 20;

export default function HistorialScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const fetchIncidents = useCallback((targetPage: number, isRefresh = false) => {
    setError(null);
    if (isRefresh) setRefreshing(true);
    else if (targetPage > 1) setLoadingMore(true);

    api
      .get<IncidentsResponse>(`/incidents?page=${targetPage}&limit=${LIMIT}`)
      .then((data) => {
        if (targetPage === 1) {
          setIncidents(data.items);
        } else {
          setIncidents((prev) => [...prev, ...data.items]);
        }
        setTotal(data.total);
        setTotalPages(data.totalPages);
        setHasMore(data.page < data.totalPages);
        setPage(targetPage);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Error al cargar el historial");
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      });
  }, []);

  useEffect(() => {
    fetchIncidents(1);
  }, [fetchIncidents]);

  const handleRefresh = useCallback(() => {
    fetchIncidents(1, true);
  }, [fetchIncidents]);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    fetchIncidents(page + 1);
  }, [page, hasMore, loadingMore, fetchIncidents]);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      
      <AppHeader
        title="Mis reportes"
        subtitle="Aquí ves el estado de cada reporte de incidente que enviaste."
      />

      {loading ? (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ActivityIndicator size="large" color="#3B348B" />
        </View>
      ) : (
        <FlatList
          data={incidents}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#3B348B"]}
              tintColor="#3B348B"
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => router.push(`/incidente/${item.id}`)}
              style={{
                backgroundColor: COLORS.white,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: COLORS.border,
                padding: 16,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: 8,
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: COLORS.textDark,
                    fontFamily: "Inter_700Bold",
                    flex: 1,
                  }}
                  numberOfLines={1}
                >
                  {item.punto_venta}
                </Text>
                <View
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 999,
                    backgroundColor: URGENCIA_COLORS[item.urgencia] + "20",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "600",
                      color: URGENCIA_COLORS[item.urgencia],
                      fontFamily: "Inter_700Bold",
                    }}
                  >
                    {item.urgencia.toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text
                style={{
                  fontSize: 14,
                  color: COLORS.textMedium,
                  fontFamily: "Inter_400Regular",
                  marginBottom: 10,
                }}
                numberOfLines={2}
              >
                {item.descripcion}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: ESTADO_COLORS[item.estado],
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 13,
                      color: "#374151",
                      fontFamily: "Inter_400Regular",
                    }}
                  >
                    {ESTADO_LABELS[item.estado]}
                  </Text>
                </View>

                <Text
                  style={{
                    fontSize: 12,
                    color: COLORS.textLight,
                    fontFamily: "Inter_400Regular",
                  }}
                >
                  {new Date(item.created_at).toLocaleDateString("es-CO")}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingTop: 60,
              }}
            >
              {error ? (
                <>
                  <AlertCircle size={40} color={COLORS.error} strokeWidth={1.5} />
                  <Text
                    style={{
                      marginTop: 12,
                      fontSize: 15,
                      color: COLORS.error,
                      fontFamily: "Inter_400Regular",
                      textAlign: "center",
                      paddingHorizontal: 20,
                    }}
                  >
                    {error}
                  </Text>
                </>
              ) : (
                <>
                  <History size={40} color="#D1D5DB" strokeWidth={1.5} />
                  <Text
                    style={{
                      marginTop: 12,
                      fontSize: 15,
                      color: COLORS.textLight,
                      fontFamily: "Inter_400Regular",
                    }}
                  >
                    No tienes incidentes reportados
                  </Text>
                </>
              )}
            </View>
          }
          ListFooterComponent={
            hasMore && !loadingMore ? (
              <TouchableOpacity
                onPress={loadMore}
                style={{
                  padding: 16,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 14, color: "#3B348B", fontFamily: "Inter_600SemiBold" }}>
                  Cargar más
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}

      <BottomTab
        activeTab="historial"
        safeBottom={insets.bottom + 4}
        onTabChange={(tab) => {
          if (tab === "chatbot") router.replace("/chat");
          if (tab === "reportar") router.replace("/reportar");
          if (tab === "ajustes") router.replace("/ajustes");
        }}
      />
    </View>
  );
}