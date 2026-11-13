import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,// <-- Importamos TouchableOpacity para la lista
   FlatList, 
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Logo from "../components/Logo";
import Input from "../components/Input";
import PrimaryButton from "../components/PrimaryButton";
import { useAuth } from "../contexts/AuthContext";
import type { LoginFormData, FormErrors } from "../types";
import { API_URL } from "../services/api"; // <-- Importamos la URL de la API

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, login, loading } = useAuth();

  useEffect(() => {
    if (user) {
      router.replace("/chat");
    }
  }, [user, router]);

  const [errors, setErrors] = useState<FormErrors>({});
  const [loginError, setLoginError] = useState("");
  const [form, setForm] = useState<LoginFormData>({
    documento: "",
    contrasena: "",
  });

  // --- NUEVOS ESTADOS PARA EL AUTOCOMPLETADO ---
  const [sugerencias, setSugerencias] = useState<{ documento: string; nombre: string }[]>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);

  // --- FUNCIÓN PARA BUSCAR LAS SUCURSALES ---
  const buscarSucursales = async (texto: string) => {
    if (texto.length < 1) { // Si borra todo, ocultamos la lista
      setSugerencias([]);
      setMostrarSugerencias(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/auth/sucursales?q=${encodeURIComponent(texto)}`);
      const data = await res.json();
      console.log("Sucursales encontradas:", data); 
      setSugerencias(data);
      setMostrarSugerencias(true);
    } catch (error) {
      console.error("Error buscando sucursales", error);
    }
  };

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.documento.trim()) newErrors.documento = "Escribe el código de tu punto de venta";
    if (!form.contrasena.trim()) newErrors.contrasena = "La contraseña es requerida";
    else if (form.contrasena.length < 6) newErrors.contrasena = "Mínimo 6 caracteres";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoginError("");
    try {
      await login(form.documento, form.contrasena);
      router.replace("/chat");
    } catch (err) {
      if (err instanceof Error) {
        const originalMsg = (err as { originalMsg?: string }).originalMsg;
        setLoginError(originalMsg || err.message);
      } else {
        setLoginError("Credenciales inválidas");
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: "#F5F6FA" }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 16,
        }}
        keyboardShouldPersistTaps="handled" 
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            width: "92%",
            maxWidth: 420,
            backgroundColor: "#FFFFFF",
            borderRadius: 24,
            padding: 24,
          }}
        >
          <Logo />

          <Text style={{ fontSize: 26, fontWeight: "700", color: "#111827", marginBottom: 4, textAlign: "center" }}>
            Bienvenido de nuevo
          </Text>

          <Text style={{ fontSize: 14, color: "#6B7280", marginBottom: 20, textAlign: "center" }}>
            Ingresa tus credenciales para continuar
          </Text>

          {loginError ? (
            <View style={{ backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: "#DC2626", fontSize: 14 }}>{loginError}</Text>
            </View>
          ) : null}

          {/* --- INPUT DE SUCURSAL CON AUTOCOMPLETADO --- */}
          <View style={{ position: "relative", zIndex: 10 }}>
            <Input
              label="Punto de venta (código o nombre)"
              placeholder="Ej: 315 o La Virgen"
              value={form.documento}
                onChangeText={(text) => {
                setForm((prev) => ({ ...prev, documento: text }));
                setErrors((prev) => prev.documento ? { ...prev, documento: undefined } : prev);
                if (loginError) setLoginError("");
                buscarSucursales(text); // <-- Deja solo esta línea
              }}
              onBlur={() => {
                // Retrasamos 200ms para que el clic en la sugerencia alcance a registrarse
              setTimeout(() => setMostrarSugerencias(false), 200);
              }}
              error={errors.documento}
              keyboardType="default"
              autoComplete="off"
            />

            {/* --- LISTA DESPLEGABLE DE SUGERENCIAS --- */}
                       {mostrarSugerencias && sugerencias.length > 0 && (
              <View style={{
                position: "absolute",
                top: 75, 
                left: 0,
                right: 0,
                backgroundColor: "#FFFFFF",
                borderWidth: 1,
                borderColor: "#E5E7EB",
                borderRadius: 8,
                maxHeight: 200, // Altura máxima de la lista
                zIndex: 9999,
                elevation: 10,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.2,
                shadowRadius: 4,
                overflow: "hidden",
              }}>
                <FlatList
                  data={sugerencias}
                  keyExtractor={(item) => item.documento}
                  nestedScrollEnabled={true} // Permite el scroll dentro del ScrollView principal
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item: suc }) => (
                    <TouchableOpacity
                      onPress={() => {
                        setForm((prev) => ({ ...prev, documento: suc.documento }));
                        setMostrarSugerencias(false);
                      }}
                      style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" }}
                    >
                      <Text style={{ fontWeight: "bold", color: "#1F2937" }}>{suc.nombre}</Text>
                      <Text style={{ fontSize: 12, color: "#6B7280" }}>Código: {suc.documento}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            )}
          </View>

          <Input
            label="Contraseña"
            placeholder="Ingrese su contraseña"
            isPassword
            value={form.contrasena}
            onChangeText={(text) => {
              setForm((prev) => ({ ...prev, contrasena: text }));
              setErrors((prev) => prev.contrasena ? { ...prev, contrasena: undefined } : prev);
              if (loginError) setLoginError("");
            }}
            error={errors.contrasena}
            autoComplete="current-password"
          />

          <View style={{ marginBottom: 20 }} />

          <PrimaryButton
            title="Iniciar Sesión"
            onPress={handleLogin}
            loading={loading}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}