import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Modal,
  FlatList,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Send,
  MessageSquare,
  ChevronDown,
  X,
  Search,
  MapPin,
} from "lucide-react-native";
import BottomTab from "../components/BottomTab";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import ReportHeader from "../components/ReportHeader";
import TextField from "../components/TextField";
import TextAreaField from "../components/TextAreaField";
import Logo from "../components/Logo";
import { api } from "../services/api";
import { logger } from "../services/logger";
import { useAuth } from "../contexts/AuthContext";

const AnimatedTouchable =
  Animated.createAnimatedComponent(TouchableOpacity);

interface FormErrors {
  nombre?: string;
  documento?: string;
  puntoVenta?: string;
  telefono?: string;
  descripcion?: string;
}

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();

  // `router.back()` es un no-op silencioso si el historial está vacío, y
  // `/reportar` siempre se entra con `replace` (historial, ajustes, exito y la
  // tab bar), así que nunca queda una entrada que popping. Con este fallback el
  // botón siempre lleva a algún lado.
  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/chat");
    }
  };

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [hasHistory, setHasHistory] = useState(false);

  const [nombre, setNombre] = useState("");
  const [documento, setDocumento] = useState("");
  const [puntoVenta, setPuntoVenta] = useState("");
  const [telefono, setTelefono] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const [pvList, setPvList] = useState<string[]>([]);
  const [showPvModal, setShowPvModal] = useState(false);
  const [pvSearch, setPvSearch] = useState("");

  const filteredPvList = useMemo(() => {
    if (!pvSearch.trim()) return pvList;
    const q = pvSearch.toLowerCase();
    return pvList.filter((pv) => pv.toLowerCase().includes(q));
  }, [pvList, pvSearch]);

  useEffect(() => {
    if (user) {
      setNombre(user.nombre);
      setDocumento(user.documento);
    }
    api.get<{ items: { telefono: string }[]; total: number }>("/incidents?limit=1").then((data) => {
      if (data?.items?.length > 0) {
        setHasHistory(true);
        if (data.items[0].telefono) {
          setTelefono(data.items[0].telefono);
        }
      }
    }).catch((err) => {
      logger.error("ReportScreen: error fetching incidents", { error: (err as Error).message });
    });

    api.get<{ nombre: string }[]>("/puntos-venta").then((list) => {
      setPvList(list.map((p) => p.nombre));
    }).catch((err) => {
      logger.error("ReportScreen: error fetching puntos-venta", { error: (err as Error).message });
    });
  }, [user]);

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { stiffness: 400, damping: 25 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { stiffness: 400, damping: 25 });
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!nombre.trim()) newErrors.nombre = "El nombre del usuario no está disponible";
    if (!documento.trim()) newErrors.documento = "El documento del usuario no está disponible";
    if (!puntoVenta.trim())
      newErrors.puntoVenta = "El punto de venta es requerido";
    if (!descripcion.trim())
      newErrors.descripcion = "La descripción es requerida";

    if (!hasHistory && !telefono.trim())
      newErrors.telefono = "El teléfono es requerido";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    setSubmitError("");

    try {
      const incident = await api.post<{ id: string }>("/incidents", {
        nombre,
        documento,
        punto_venta: puntoVenta,
        telefono,
        descripcion,
      });

      router.replace({
        pathname: "/exito",
        params: { ticketId: incident.id },
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Error al enviar el reporte"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#F5F6FA]">
      <View style={{ paddingTop: insets.top }}>
        <ReportHeader />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            alignItems: "center",
            paddingTop: 24,
            paddingBottom: 32,
            paddingHorizontal: 16,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center mb-4">
            <Logo size={80} />
          </View>

          <Text
            className="text-[34px] text-[#1F2366] text-center mb-2"
            style={{ fontFamily: "Inter_700Bold", fontWeight: "700" }}
          >
            Reportar un Incidente
          </Text>

          <Text className="text-[15px] font-inter text-[#6B7280] text-center mb-6 max-w-[300px]">
            Por favor, completa los detalles para que nuestro equipo
            técnico pueda ayudarte.
          </Text>

          {submitError ? (
            <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 w-[92%]">
              <Text className="text-red-700 text-sm font-inter">
                {submitError}
              </Text>
            </View>
          ) : null}

          <View
            className="bg-white rounded-[18px] border border-[#E5E7EB] p-5 w-[92%]"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <TextField
              label="Nombre Completo"
              placeholder="Tu nombre completo"
              value={nombre}
              onChangeText={(t) => {
                setNombre(t);
                if (errors.nombre)
                  setErrors({ ...errors, nombre: undefined });
              }}
              error={errors.nombre}
              editable={false}
            />

            <TextField
              label="CC / Documento"
              placeholder="Número de documento"
              value={documento}
              onChangeText={(t) => {
                setDocumento(t);
                if (errors.documento)
                  setErrors({ ...errors, documento: undefined });
              }}
              error={errors.documento}
              keyboardType="numeric"
              editable={false}
            />

            <TouchableOpacity
              onPress={() => setShowPvModal(true)}
              style={{
                width: "100%", marginBottom: 16,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", fontFamily: "Inter_700Bold", marginBottom: 6 }}>
                Punto de Venta
              </Text>
              <View
                style={{
                  flexDirection: "row", alignItems: "center",
                  height: 52, borderRadius: 12,
                  borderWidth: 1, borderColor: errors.puntoVenta ? "#EF4444" : "#E5E7EB",
                  backgroundColor: "#F9FAFB", paddingHorizontal: 14,
                }}
              >
                <MapPin size={18} color="#9CA3AF" strokeWidth={2} style={{ marginRight: 10 }} />
                <Text
                  style={{
                    flex: 1, fontSize: 15, color: puntoVenta ? "#1F2937" : "#9CA3AF",
                    fontFamily: "Inter_400Regular",
                  }}
                >
                  {puntoVenta || "Selecciona un punto de venta"}
                </Text>
                <ChevronDown size={18} color="#9CA3AF" strokeWidth={2} />
              </View>
              {errors.puntoVenta && (
                <Text style={{ fontSize: 12, color: "#EF4444", fontFamily: "Inter_400Regular", marginTop: 4 }}>
                  {errors.puntoVenta}
                </Text>
              )}
            </TouchableOpacity>

            <TextField
              label="Número de Teléfono"
              placeholder="Tu número de contacto"
              value={telefono}
              onChangeText={(t) => {
                setTelefono(t);
                if (errors.telefono)
                  setErrors({ ...errors, telefono: undefined });
              }}
              keyboardType="phone-pad"
              editable={!hasHistory}
              error={errors.telefono}
            />

            <TextAreaField
              label="Descripción"
              placeholder="Describe qué sucedió..."
              value={descripcion}
              onChangeText={(t) => {
                setDescripcion(t);
                if (errors.descripcion)
                  setErrors({ ...errors, descripcion: undefined });
              }}
              error={errors.descripcion}
            />

            <AnimatedTouchable
              onPress={handleSubmit}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={loading}
              activeOpacity={0.85}
              style={[
                animatedStyle,
                {
                  width: "100%" as const,
                  height: 52,
                  borderRadius: 10,
                  backgroundColor: loading
                    ? "rgba(42, 35, 126, 0.7)"
                    : "#2A237E",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 16,
                  shadowColor: "#2A237E",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.25,
                  shadowRadius: 8,
                  elevation: 5,
                },
              ]}
            >
              <Send size={18} color="#FFFFFF" strokeWidth={2.5} />
              <Text
                className="text-white text-base ml-2"
                style={{ fontFamily: "Inter_700Bold" }}
              >
                {loading ? "Enviando..." : "Enviar Reporte"}
              </Text>
            </AnimatedTouchable>
          </View>

          <TouchableOpacity
            onPress={goBack}
            className="flex-row items-center justify-center mt-5"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MessageSquare size={18} color="#1F2366" strokeWidth={2} />
            <Text className="text-[#1F2366] text-sm font-inter ml-2">
              Volver al chat
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <BottomTab
        activeTab="reportar"
        safeBottom={insets.bottom + 4}
        onTabChange={(tab) => {
          if (tab === "chatbot") router.replace("/chat");
          if (tab === "historial") router.replace("/historial");
          if (tab === "ajustes") router.replace("/ajustes");
        }}
      />

      <Modal
        visible={showPvModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPvModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#FFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "80%", paddingBottom: 30 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" }}>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#1F2366", fontFamily: "Inter_700Bold" }}>
                Seleccionar punto de venta
              </Text>
              <TouchableOpacity onPress={() => setShowPvModal(false)}>
                <X size={22} color="#6B7280" strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", borderRadius: 10, height: 44, paddingHorizontal: 12 }}>
                <Search size={18} color="#9CA3AF" strokeWidth={2} />
                <TextInput
                  style={{ flex: 1, marginLeft: 8, fontSize: 15, color: "#1F2937", fontFamily: "Inter_400Regular" }}
                  placeholder="Buscar punto de venta..."
                  placeholderTextColor="#9CA3AF"
                  value={pvSearch}
                  onChangeText={setPvSearch}
                  autoFocus
                />
                {pvSearch ? (
                  <TouchableOpacity onPress={() => setPvSearch("")}>
                    <X size={18} color="#9CA3AF" strokeWidth={2} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <FlatList
              data={filteredPvList}
              keyExtractor={(item) => item}
              style={{ maxHeight: 400 }}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => {
                    setPuntoVenta(item);
                    setPvSearch("");
                    setShowPvModal(false);
                    if (errors.puntoVenta) setErrors({ ...errors, puntoVenta: undefined });
                  }}
                  style={{
                    paddingVertical: 14, paddingHorizontal: 12,
                    borderBottomWidth: 1, borderBottomColor: "#F3F4F6",
                    backgroundColor: puntoVenta === item ? "#F3F0FF" : "transparent",
                    borderRadius: 8, marginBottom: 2,
                  }}
                >
                  <Text style={{ fontSize: 15, color: puntoVenta === item ? "#25207E" : "#1F2937", fontFamily: "Inter_400Regular", fontWeight: puntoVenta === item ? "600" : "400" }}>
                    {item}
                  </Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={{ textAlign: "center", color: "#9CA3AF", fontFamily: "Inter_400Regular", paddingVertical: 20, fontSize: 14 }}>
                  {pvList.length === 0 ? "Cargando puntos de venta..." : "No se encontraron resultados"}
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
