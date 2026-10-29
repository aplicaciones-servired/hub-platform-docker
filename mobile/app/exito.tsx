import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
  Check,
  Copy,
  MessageSquare,
} from "lucide-react-native";
import BottomTab from "../src/components/BottomTab";
import { useAuth } from "../src/contexts/AuthContext";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Logo from "../src/components/Logo";
import { formatTicketId } from "../src/lib/format";

export default function SuccessScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>();
  const [copied, setCopied] = useState(false);
  const { user } = useAuth();

  const userId = ticketId
    ? formatTicketId(ticketId)
    : "Ticket no disponible";

  const scaleOuter = useSharedValue(0.6);
  const scaleInner = useSharedValue(0);
  const opacity = useSharedValue(0);
  const cardOpacity = useSharedValue(0);
  const cardY = useSharedValue(30);

  useEffect(() => {
    scaleOuter.value = withSpring(1, { stiffness: 200, damping: 12 });
    scaleInner.value = withDelay(200, withSpring(1, { stiffness: 300, damping: 10 }));
    opacity.value = withDelay(400, withTiming(1, { duration: 300, easing: Easing.ease }));
    cardOpacity.value = withDelay(600, withTiming(1, { duration: 400, easing: Easing.ease }));
    cardY.value = withDelay(600, withTiming(0, { duration: 400, easing: Easing.ease }));
  }, []);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleOuter.value }],
  }));

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleInner.value }],
  }));

  const fadeStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardY.value }],
  }));

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleCopy = () => {
    Clipboard.setStringAsync(userId);
    setCopied(true);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F6FA" }}>
      {/* Header */}
      <View
        style={{
          paddingTop: insets.top,
          backgroundColor: "#FFFFFF",
          borderBottomWidth: 1,
          borderBottomColor: "#E5E7EB",
        }}
      >
        <View
          style={{
            height: 72,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Logo size={32} />
          </View>
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
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#25207E",
                fontFamily: "Inter_700Bold",
              }}
            >
              {user?.nombre
                ? user.nombre.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                : "??"}
            </Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={{
          alignItems: "center",
          paddingHorizontal: 16,
          paddingTop: 24,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Icon */}
        <Animated.View
          style={[
            {
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: "#E7EEF9",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 24,
            },
            { shadowColor: "#25207E", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 4 },
            outerStyle,
          ]}
        >
          <Animated.View
            style={[
              {
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: "#25207E",
                alignItems: "center",
                justifyContent: "center",
              },
              innerStyle,
            ]}
          >
            <Check size={24} color="#FFFFFF" strokeWidth={3.5} />
          </Animated.View>
        </Animated.View>

        {/* Title */}
        <Animated.View style={[{ width: "100%" }, fadeStyle]}>
          <Text
            style={{
              fontSize: 28,
              fontWeight: "700",
              color: "#25207E",
              fontFamily: "Inter_700Bold",
              textAlign: "center",
              marginBottom: 12,
            }}
          >
            ¡Reporte Enviado!
          </Text>
        </Animated.View>

        {/* Description */}
        <Animated.View style={[{ width: "100%" }, fadeStyle]}>
          <Text
            style={{
              fontSize: 15,
              lineHeight: 24,
              color: "#6B7280",
              fontFamily: "Inter_400Regular",
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            Hemos recibido tu reporte. Un agente técnico revisará los detalles y
            se pondrá en contacto contigo a través del chat o una llamada en la
            brevedad.
          </Text>
        </Animated.View>

        {/* Ticket Card */}
        <Animated.View
          style={[
            {
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#D9DCE8",
              borderRadius: 14,
              padding: 16,
              width: "100%",
              marginBottom: 16,
            },
            { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
            cardStyle,
          ]}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "600",
              color: "#6B7280",
              fontFamily: "Inter_700Bold",
              textAlign: "center",
              letterSpacing: 1,
              marginBottom: 10,
            }}
          >
            NÚMERO DE TICKET
          </Text>

          <View
            style={{
              backgroundColor: "#EEF2FF",
              borderRadius: 10,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
              paddingVertical: 12,
              minHeight: 48,
            }}
          >
            <Text
              style={{
                flex: 1,
                flexShrink: 1,
                fontSize: 22,
                fontWeight: "700",
                color: "#25207E",
                fontFamily: "Inter_700Bold",
                flexWrap: "wrap",
              }}
            >
              {userId}
            </Text>
            <TouchableOpacity
              onPress={handleCopy}
              style={{ padding: 4, marginLeft: 8, flexShrink: 0 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Copy size={18} color="#25207E" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {copied && (
            <Text
              style={{
                fontSize: 12,
                color: "#22C55E",
                fontFamily: "Inter_400Regular",
                textAlign: "center",
                marginTop: 8,
              }}
            >
              Copiado ✓
            </Text>
          )}
        </Animated.View>

        {/* ¿Necesitas algo más? Card */}
        <Animated.View
          style={[
            {
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#D9DCE8",
              borderRadius: 14,
              padding: 16,
              width: "100%",
              marginBottom: 16,
            },
            { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
            cardStyle,
          ]}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              color: "#1F2937",
              fontFamily: "Inter_600SemiBold",
              marginBottom: 6,
            }}
          >
            ¿Necesitas algo más?
          </Text>

          <Text
            style={{
              fontSize: 13,
              lineHeight: 20,
              color: "#6B7280",
              fontFamily: "Inter_400Regular",
              marginBottom: 16,
            }}
          >
            Puedes seguir hablando con nosotros si necesitas ayuda adicional.
          </Text>

          <TouchableOpacity
            onPress={() => router.replace("/chat")}
            activeOpacity={0.85}
            style={{
              height: 46,
              borderRadius: 10,
              backgroundColor: "#25207E",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <MessageSquare size={16} color="#FFFFFF" strokeWidth={2} />
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#FFFFFF",
                fontFamily: "Inter_600SemiBold",
              }}
            >
              Regresar al Chat
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Ver detalle button */}
        <Animated.View style={[{ width: "100%" }, cardStyle]}>
          <TouchableOpacity
            onPress={() => {
              if (ticketId) {
                router.replace({ pathname: "/incidente/[id]", params: { id: ticketId } });
              } else {
                router.replace("/historial");
              }
            }}
            activeOpacity={0.85}
            style={{
              height: 46,
              borderRadius: 10,
              backgroundColor: "#DCD4FF",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: "600",
                color: "#4B5563",
                fontFamily: "Inter_600SemiBold",
              }}
            >
              Ver detalle del Reporte
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      <BottomTab
        activeTab="reportar"
        safeBottom={insets.bottom + 4}
        onTabChange={(tab) => {
          if (tab === "chatbot") router.replace("/chat");
          if (tab === "historial") router.replace("/historial");
          if (tab === "ajustes") router.replace("/ajustes");
        }}
      />
    </View>
  );
}
