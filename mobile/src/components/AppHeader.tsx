import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import Logo from "./Logo";
import { useAuth } from "../contexts/AuthContext";

// Datos que recibe el encabezado desde cada pantalla
interface AppHeaderProps {
  title: string;        // Nombre de la pantalla (obligatorio)
  subtitle?: string;    // Frase corta debajo del título (opcional, por eso el "?")
  onBack?: () => void;  // Si se pasa, aparece la flecha para volver (opcional)
}

// Saca las iniciales del nombre: "Punto de Prueba" -> "PD"
function getIniciales(nombre?: string): string {
  if (!nombre) return "";
  return nombre
    .split(" ")
    .filter(Boolean)
    .map((parte) => parte[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function AppHeader({ title, subtitle, onBack }: AppHeaderProps) {
  const insets = useSafeAreaInsets(); // Espacio de la barra de estado del celular
  const { user } = useAuth();         // Usuario que inició sesión
  const iniciales = getIniciales(user?.nombre);

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

        {iniciales ? (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: "#DCD4FF",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 14, color: "#25207E", fontFamily: "Inter_700Bold", fontWeight: "700" }}>
              {iniciales}
            </Text>
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