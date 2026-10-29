import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Updates from "expo-updates";
import { logger } from "../src/services/logger";
import { clearApiCache } from "../src/services/storage";
import {
  Trash2,
  LogOut,
  Database,
} from "lucide-react-native";
import BottomTab from "../src/components/BottomTab";
import AppHeader from "../src/components/AppHeader";
import { useAuth } from "../src/contexts/AuthContext";

function confirmAction(title: string, message: string): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(message));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
      { text: "Aceptar", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [clearing, setClearing] = useState(false);
  const [cacheInfo, setCacheInfo] = useState({ items: 0, size: "0 KB" });

  useEffect(() => {
    estimateCache();
  }, []);

  function estimateCache() {
    let items = 0;
    let bytes = 0;
    if (typeof localStorage !== "undefined") {
      const lsItems = localStorage.length || 0;
      for (let i = 0; i < lsItems; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("api_cache_")) {
          items++;
          bytes += key.length * 2;
          bytes += (localStorage.getItem(key)?.length || 0) * 2;
        }
      }
    }
    const size = bytes < 1024
      ? `${bytes} B`
      : bytes < 1048576
        ? `${(bytes / 1024).toFixed(1)} KB`
        : `${(bytes / 1048576).toFixed(1)} MB`;
    setCacheInfo({ items, size });
  }

  async function handleClearCache() {
    const confirmed = await confirmAction(
      "Limpiar Caché",
      "¿Estás seguro de querer eliminar el caché de esta app? Se reiniciará si le das Aceptar."
    );
    if (!confirmed) return;
    setClearing(true);
    try {
      await logout();
      await clearApiCache();
      if (Platform.OS === "web") {
        window.location.reload();
      } else {
        await Updates.reloadAsync();
      }
    } catch (err) {
      logger.error("Clear cache error", { error: (err as Error).message });
      if (Platform.OS !== "web") {
        Alert.alert("Error", "No se pudo limpiar la caché completamente.");
      }
      setClearing(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F6FA" }}>
     
      <AppHeader
        title="Ajustes"
        subtitle="Opciones de la aplicacion y cierre de sesión"
      />

      {/* Content */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 24,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Cache Card */}
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#D9DCE8",
            borderRadius: 14,
            padding: 16,
            marginBottom: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: "#FEE2E2",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Trash2 size={18} color="#DC2626" strokeWidth={2} />
            </View>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: "#1F2937",
                fontFamily: "Inter_700Bold",
              }}
            >
              Limpiar Caché
            </Text>
          </View>

          <Text
            style={{
              fontSize: 13,
              lineHeight: 20,
              color: "#6B7280",
              fontFamily: "Inter_400Regular",
              marginBottom: 16,
            }}
          >
            Elimina los datos almacenados localmente (tokens, sesión, archivos temporales).
            La app se recargará automáticamente para aplicar los cambios.
          </Text>

          {/* Stats */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            <View style={{ flex: 1, backgroundColor: "#F9FAFB", borderRadius: 8, padding: 10, alignItems: "center" }}>
              <Database size={16} color="#6B7280" strokeWidth={2} />
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#1F2937", fontFamily: "Inter_700Bold", marginTop: 4 }}>
                {cacheInfo.items}
              </Text>
              <Text style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "Inter_400Regular" }}>ítems</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: "#F3F0FF", borderRadius: 8, padding: 10, alignItems: "center" }}>
              <Trash2 size={16} color="#25207E" strokeWidth={2} />
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#25207E", fontFamily: "Inter_700Bold", marginTop: 4 }}>
                {cacheInfo.size}
              </Text>
              <Text style={{ fontSize: 11, color: "#9CA3AF", fontFamily: "Inter_400Regular" }}>tamaño</Text>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleClearCache}
            disabled={clearing}
            activeOpacity={0.85}
            style={{
              height: 46,
              borderRadius: 10,
              backgroundColor: clearing ? "#FCA5A5" : "#DC2626",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Trash2 size={16} color="#FFFFFF" strokeWidth={2} />
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#FFFFFF",
                fontFamily: "Inter_700Bold",
              }}
            >
              {clearing ? "Limpiando..." : "Limpiar Caché"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Cerrar Sesión */}
        <View
          style={{
            backgroundColor: "#FFFFFF",
            borderWidth: 1,
            borderColor: "#D9DCE8",
            borderRadius: 14,
            padding: 16,
            marginBottom: 16,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: "#FEF3C7",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LogOut size={18} color="#D97706" strokeWidth={2} />
            </View>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "600",
                color: "#1F2937",
                fontFamily: "Inter_700Bold",
              }}
            >
              Cerrar Sesión
            </Text>
          </View>

          <Text
            style={{
              fontSize: 13,
              lineHeight: 20,
              color: "#6B7280",
              fontFamily: "Inter_400Regular",
              marginBottom: 16,
            }}
          >
            {user?.nombre
              ? `Sesión iniciada como ${user.nombre}`
              : "Sesión iniciada"}
          </Text>

          <TouchableOpacity
            onPress={async () => {
              const confirmed = await confirmAction(
                "Cerrar Sesión",
                "¿Estás seguro de cerrar sesión?"
              );
              if (!confirmed) return;
              try {
                await logout();
                router.replace("/");
              } catch (e) {
                Alert.alert("Error", "No se pudo cerrar sesión. Intenta de nuevo.");
              }
            }}
            activeOpacity={0.85}
            style={{
              height: 46,
              borderRadius: 10,
              backgroundColor: "#FEF3C7",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <LogOut size={16} color="#D97706" strokeWidth={2} />
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#D97706",
                fontFamily: "Inter_700Bold",
              }}
            >
              Cerrar Sesión
            </Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      <BottomTab
        activeTab="ajustes"
        safeBottom={insets.bottom + 4}
        onTabChange={(tab) => {
          if (tab === "chatbot") router.replace("/chat");
          if (tab === "reportar") router.replace("/reportar");
          if (tab === "historial") router.replace("/historial");
        }}
      />
    </View>
  );
}
