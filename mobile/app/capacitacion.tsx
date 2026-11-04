import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CirclePlay, Clock } from "lucide-react-native";
import AppHeader from "../src/components/AppHeader";
import BottomTab from "../src/components/BottomTab";
import { VIDEOS_CAPACITACION } from "../src/constants/videos";

export default function CapacitacionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F6FA" }}>
      <AppHeader
        title="Capacitación"
        subtitle="Videos cortos para aprender a usar la app"
      />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {VIDEOS_CAPACITACION.map((video, index) => {
          // Si el video todavía no tiene dirección, se muestra como "Próximamente"
          const disponible = video.url !== "";

          return (
            <TouchableOpacity
              key={video.id}
              disabled={!disponible}
              onPress={() => Linking.openURL(video.url)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Video ${index + 1}: ${video.titulo}`}
              style={{
                backgroundColor: "#FFFFFF",
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "#E5E7EB",
                padding: 16,
                marginBottom: 14,
                flexDirection: "row",
                gap: 14,
                opacity: disponible ? 1 : 0.85,
              }}
            >
              {/* Ícono grande a la izquierda */}
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: disponible ? "#EEEDF8" : "#F3F4F6",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {disponible ? (
                  <CirclePlay size={30} color="#201A7A" strokeWidth={2} />
                ) : (
                  <Clock size={26} color="#9CA3AF" strokeWidth={2} />
                )}
              </View>

              {/* Textos */}
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: "#6B7280", fontFamily: "Inter_400Regular" }}>
                  Video {index + 1}
                  {video.duracion ? ` · ${video.duracion}` : ""}
                </Text>
                <Text
                  style={{
                    fontSize: 17,
                    color: "#1F2366",
                    fontFamily: "Inter_700Bold",
                    fontWeight: "700",
                    marginTop: 2,
                  }}
                >
                  {video.titulo}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: "#4B5563",
                    fontFamily: "Inter_400Regular",
                    lineHeight: 20,
                    marginTop: 4,
                  }}
                >
                  {video.descripcion}
                </Text>

                {/* Etiqueta: "Ver video" o "Próximamente" */}
                <View
                  style={{
                    alignSelf: "flex-start",
                    marginTop: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 999,
                    backgroundColor: disponible ? "#201A7A" : "#F3F4F6",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      color: disponible ? "#FFFFFF" : "#6B7280",
                      fontFamily: "Inter_700Bold",
                    }}
                  >
                    {disponible ? "Ver video" : "Próximamente"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <BottomTab
        activeTab="capacitacion"
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