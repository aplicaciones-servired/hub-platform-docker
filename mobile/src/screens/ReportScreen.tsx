import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import {
  Send,
} from "lucide-react-native";
import BottomTab from "../components/BottomTab";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import AppHeader from "../components/AppHeader";
import TextField from "../components/TextField";
import TextAreaField from "../components/TextAreaField";
import CategoriaSelector from "../components/CategoriaSelector";
import FotosSelector from "../components/FotosSelector";
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
  categoria?: string;
  reportanteNombre?: string;
  reportanteCedula?: string;
}

export default function ReportScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
    // Si se llega desde el chat, trae el tipo elegido: /reportar?categoria=energia
  const params = useLocalSearchParams<{ categoria?: string }>();

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [] = useState(true);

  const [nombre, setNombre] = useState("");
  const [documento, setDocumento] = useState("");
  const [puntoVenta, setPuntoVenta] = useState("");
  const [telefono, setTelefono] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const [categoria, setCategoria] = useState("");
  const [reportanteNombre, setReportanteNombre] = useState("");
  const [reportanteCedula, setReportanteCedula] = useState("");
  const [fotos, setFotos] = useState<string[]>([]);

  // Cuando llega un tipo desde el chat, lo deja seleccionado en el formulario
  useEffect(() => {
    if (params.categoria) setCategoria(params.categoria);
  }, [params.categoria]);

  useEffect(() => {
    if (user) {
      setNombre(user.nombre);
      setDocumento(user.documento);
      setPuntoVenta(user.nombre);
    }
    api.get<{
      items: { telefono: string; reportante_nombre?: string | null; reportante_cedula?: string | null }[];
      total: number;
    }>("/incidents?limit=1").then((data) => {
      if (data?.items?.length > 0) {
        if (data.items[0].telefono) {
          setTelefono(data.items[0].telefono);
        }

                if (data.items[0].reportante_nombre) {
          setReportanteNombre(data.items[0].reportante_nombre);
        }
        if (data.items[0].reportante_cedula) {
          setReportanteCedula(data.items[0].reportante_cedula);
        }
      }
    }).catch((err) => {
      logger.error("ReportScreen: error fetching incidents", { error: (err as Error).message });
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

        if (!categoria)
      newErrors.categoria = "Elige el tipo de problema que presentas";

    if (!telefono.trim())
      newErrors.telefono = "Escribe un teléfono de contacto";
    else if (!/^\d{10}$/.test(telefono.trim()))
      newErrors.telefono = "El teléfono debe tener 10 números, sin espacios ni guiones";
        if (reportanteNombre.trim().length < 3)
      newErrors.reportanteNombre = "Escribe tu nombre completo";

    if (!reportanteCedula.trim())
      newErrors.reportanteCedula = "Escribe tu número de cédula";
    else if (!/^\d{6,10}$/.test(reportanteCedula.trim()))
      newErrors.reportanteCedula = "La cédula debe tener solo números (entre 6 y 10), sin puntos ni espacios";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

    const handleSubmit = async () => {
    if (!validate()) return;

    setLoading(true);
    setSubmitError("");

    try {
      const uploadedImageNames: string[] = [];

      // 1. SUBIR LAS FOTOS A MINIO
      if (fotos.length > 0) {
        
        for (const fotoUri of fotos) {
          const formData = new FormData();
          const filename = fotoUri.startsWith("data:image/png")
            ? `foto-portapapeles-${Date.now()}.png`
            : fotoUri.split("/").pop() || `foto-${Date.now()}.jpg`;

          if (Platform.OS === "web" || fotoUri.startsWith("data:")) {
            const blob = await fetch(fotoUri).then(r => r.blob());
            formData.append('file', blob, filename);
          } else {
            // En el celular, la foto es una URI file://...
            formData.append('file', {
              uri: fotoUri,
              name: filename,
              type: 'image/jpeg',
            } as any);
          }

          // Enviamos al backend
          const uploadRes = await api.upload<{ url?: string; filename?: string; name?: string }>(
            "/upload/incidente", 
            formData
          );
          

          const savedName = (uploadRes as any).key || uploadRes.filename || uploadRes.url || uploadRes.name;
          if (savedName) {
            uploadedImageNames.push(savedName);
          }
        }
      }

      // 2. CREAR EL REPORTE CON LOS NOMBRES DE LAS FOTOS
      const incident = await api.post<{ id: string }>("/incidents", {
        nombre,
        documento,
        punto_venta: puntoVenta,
        telefono,
        descripcion,
        categoria,
        reportante_nombre: reportanteNombre.trim(),
        reportante_cedula: reportanteCedula.trim(),
        imagenes: uploadedImageNames.length > 0 ? uploadedImageNames : undefined, // <--- Aquí se envían las fotos
      });

      router.replace({
        pathname: "/exito",
        params: { ticketId: incident.id },
      });
    } catch (err) {
      console.error("Error en handleSubmit:", err);
      setSubmitError(
        err instanceof Error ? err.message : "Error al enviar el reporte"
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <View className="flex-1 bg-[#F5F6FA]">
            <AppHeader 
            title="Reporte de Incidente" 
            subtitle="Cuentanos qué pasó"
            />

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

          <Text
            className="text-[24px] text-[#1F2366] text-center mb-2"
            style={{ fontFamily: "Inter_700Bold", fontWeight: "700" }}
          >
            Reportar incidente
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
            <View
              style={{
                backgroundColor: "#EEEDF8",
                borderRadius: 10,
                padding: 12,
                marginBottom: 10,
              }}
            >
              <TextField
              label="Nombre del punto"
              placeholder="Nombre del punto de venta"
              value={puntoVenta}
              onChangeText={setPuntoVenta}
              editable={false}
            />

            <TextField
              label="Tu nombre completo"
              placeholder="Ej: María Pérez Gómez"
              value={reportanteNombre}
              onChangeText={(t) => {
                setReportanteNombre(t);
                if (errors.reportanteNombre)
                  setErrors({ ...errors, reportanteNombre: undefined });
              }}
              error={errors.reportanteNombre}
            />

            <TextField
              label="Tu cédula"
              placeholder="Solo números, sin puntos"
              value={reportanteCedula}
              onChangeText={(t) => {
                setReportanteCedula(t);
                if (errors.reportanteCedula)
                  setErrors({ ...errors, reportanteCedula: undefined });
              }}
              keyboardType="numeric"
              error={errors.reportanteCedula}
            />

            <TextField
              label="Telefono de contacto (confirmalo)"
              placeholder="Tu número de contacto"
              value={telefono}
              onChangeText={(t) => {
                setTelefono(t);
                if (errors.telefono)
                  setErrors({ ...errors, telefono: undefined });
              }}
              keyboardType="phone-pad"
              error={errors.telefono}
            />

            <CategoriaSelector
              value={categoria}
              onChange={(codigo) => {
                setCategoria(codigo);
                if (errors.categoria)
                  setErrors({ ...errors, categoria: undefined });
              }}
              error={errors.categoria}
            />

                        {/* Instrucciones para escribir una buena descripción */}
            
              <Text style={{ fontSize: 14, color: "#1F2366", fontFamily: "Inter_700Bold", marginBottom: 4 }}>
                Para recibir una respuesta rápida:
              </Text>
              <Text style={{ fontSize: 14, color: "#1F2937", fontFamily: "Inter_400Regular", lineHeight: 20 }}>
                • Llena todos los campos. Sin ellos no se puede enviar el reporte.{"\n"}
                • Revisa que tu nombre, tu cédula y tu teléfono estén bien escritos.{"\n"}
                • En la descripción, explica qué pasó, desde cuándo y qué equipo o programa falla.
              </Text>
            </View>
            <TextAreaField
              label="Descripción"
              placeholder="Ej: La impresora no imprime desde esta mañana"
              value={descripcion}
              onChangeText={(t) => {
                setDescripcion(t);
                if (errors.descripcion)
                  setErrors({ ...errors, descripcion: undefined });
              }}
              error={errors.descripcion}
            />

            
            <FotosSelector fotos={fotos} onChange={setFotos} />

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

        </ScrollView>
      </KeyboardAvoidingView>

      <BottomTab
        activeTab="reportar"
        safeBottom={insets.bottom + 4}
        onTabChange={(tab) => {
          if (tab === "chatbot") router.replace("/chat");
          if (tab === "historial") router.replace("/historial");
          if (tab === "capacitacion") router.replace("/capacitacion");
        }}
      />

    </View>
  );
}
