import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { X } from "lucide-react-native";
import { API_URL } from "../services/api";

interface VideoCapacitacionProps {
  archivo: string;      // Nombre del video en MinIO, ej: "inicio.mp4"
  titulo: string;       // Título que se muestra arriba
  onCerrar: () => void; // Se ejecuta al tocar "Cerrar"
}

// Muestra un video de capacitación. Funciona igual que las fotos:
// la app le pide el video a la API con la sesión del punto.
export default function VideoCapacitacion({ archivo, titulo, onCerrar }: VideoCapacitacionProps) {
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    let activo = true;
    let objectUrl: string | null = null;

    async function cargarVideo() {
      try {
        const respuesta = await fetch(`${API_URL}/upload/capacitacion/${encodeURIComponent(archivo)}`, {
          headers: { "X-Auth-Scope": "user", "X-Auth-Client": "mobile" },
          credentials: "include",
        });
        if (!respuesta.ok) throw new Error(`No se pudo cargar el video (${respuesta.status})`);
        const blob = await respuesta.blob();
        objectUrl = URL.createObjectURL(blob);
        if (activo) setVideoUri(objectUrl);
      } catch {
        if (activo) setError(true);
      }
    }

    cargarVideo();

    return () => {
      activo = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [archivo]);

  return (
    <View style={{ flex: 1, backgroundColor: "#111827", padding: 16, justifyContent: "center" }}>
      {/* Título y botón grande para cerrar */}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
        <Text
          style={{ flex: 1, fontSize: 18, color: "#FFFFFF", fontFamily: "Inter_700Bold", fontWeight: "700" }}
          numberOfLines={2}
        >
          {titulo}
        </Text>
        <TouchableOpacity
          onPress={onCerrar}
          accessibilityRole="button"
          accessibilityLabel="Cerrar video"
          activeOpacity={0.7}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: "#FFFFFF",
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 999,
            marginLeft: 12,
          }}
        >
          <X size={20} color="#201A7A" strokeWidth={2.5} />
          <Text style={{ fontSize: 16, color: "#201A7A", fontFamily: "Inter_700Bold", fontWeight: "700" }}>
            Cerrar
          </Text>
        </TouchableOpacity>
      </View>

      {Platform.OS !== "web" ? (
        <Text style={{ color: "#FFFFFF", fontSize: 16, textAlign: "center" }}>
          Este video se puede ver en la versión web de la app.
        </Text>
      ) : error ? (
        <Text style={{ color: "#FFFFFF", fontSize: 16, textAlign: "center", lineHeight: 24 }}>
          No se pudo cargar el video. Revisa tu conexión a internet y vuelve a intentarlo.
        </Text>
      ) : !videoUri ? (
        <View style={{ alignItems: "center", gap: 12 }}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 16, textAlign: "center" }}>
            Cargando video... puede tardar unos segundos.
          </Text>
        </View>
      ) : (
        <video
          src={videoUri}
          controls
          autoPlay
          playsInline
          style={{ width: "100%", maxHeight: "75vh", borderRadius: 12, backgroundColor: "#000000" }}
        />
      )}
    </View>
  );
}