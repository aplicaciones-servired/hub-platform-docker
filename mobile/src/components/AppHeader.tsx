import React from "react";
import { View, Text, TouchableOpacity, Platform, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, LogOut } from "lucide-react-native";
import Logo from "./Logo";
import { useAuth } from "../contexts/AuthContext";

// Datos que recibe el encabezado desde cada pantalla
interface AppHeaderProps {
  title: string;        // Nombre de la pantalla (obligatorio)
  subtitle?: string;    // Frase corta debajo del título (opcional, por eso el "?")
  onBack?: () => void;  // Si se pasa, aparece la flecha para volver (opcional)
}


// Pregunta antes de cerrar sesión, para que no se salga por tocar sin querer
function confirmarSalida(): Promise<boolean> {
  const mensaje = "¿Quieres cerrar sesión? Tendrás que volver a escribir tu documento y contraseña.";
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(mensaje));
  }
  return new Promise((resolve) => {
    Alert.alert("Cerrar sesión", mensaje, [
      { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
      { text: "Cerrar sesión", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

export default function AppHeader({ title, subtitle, onBack }: AppHeaderProps) {
  const insets = useSafeAreaInsets(); // Espacio de la barra de estado del celular
  const { user, logout } = useAuth(); // Usuario que inició sesión y la función para salir
  const router = useRouter();

  // Al tocar "Cerrar sesión": pregunta, cierra la sesión y vuelve al login
  const handleCerrarSesion = async () => {
    const confirmado = await confirmarSalida();
    if (!confirmado) return;
    await logout();
    router.replace("/");
  };

  return (
    // Caja blanca de todo el encabezado, con línea gris abajo
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: "#FFFFFF",
        borderBottomWidth: 1,
        borderBottomColor: "#E5E7EB",
      }}
    >
      {/* FILA 1: logo a la izquierda, iniciales a la derecha */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 12,
        }}
      >
        <Logo size={28} />

                {user ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              flexShrink: 1,
              marginLeft: 12,
            }}
          >
            {/* Nombre completo del punto */}
            <Text
              numberOfLines={1}
              style={{
                flexShrink: 1,
                fontSize: 15,
                color: "#1F2366",
                fontFamily: "Inter_700Bold",
                fontWeight: "700",
              }}
            >
              {user.nombre}
            </Text>

            {/* Botón para cerrar sesión (solo ícono) */}
            <TouchableOpacity
              onPress={handleCerrarSesion}
              accessibilityRole="button"
              accessibilityLabel="Cerrar sesión"
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 40,
                height: 40,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LogOut size={22} color="#B91C1C" strokeWidth={2.2} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* FILA 2: flecha (opcional) + título + subtítulo (opcional) */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: 14,
        }}
      >
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            accessibilityLabel="Volver"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ marginRight: 12 }}
          >
            <ArrowLeft size={22} color="#1F2366" strokeWidth={2.2} />
          </TouchableOpacity>
        ) : null}

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 22, color: "#1F2366", fontFamily: "Inter_700Bold", fontWeight: "700" }}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ fontSize: 15, color: "#6B7280", fontFamily: "Inter_400Regular", marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}