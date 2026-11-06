import { useState } from "react";
import { View, Text, TouchableOpacity, Image, Alert, Modal, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import { Camera, X } from "lucide-react-native";

const MAX_FOTOS = 3;

interface FotosSelectorProps {
  fotos: string[];                        // Fotos elegidas (dirección local de cada una)
  onChange: (fotos: string[]) => void;    // Se ejecuta al agregar o quitar fotos
}

// Recuadro para adjuntar hasta 3 fotos del problema (opcional)
export default function FotosSelector({ fotos, onChange }: FotosSelectorProps) {
  const quedan = MAX_FOTOS - fotos.length;
  const [selectorVisible, setSelectorVisible] = useState(false);
  const [pasteError, setPasteError] = useState("");

  // Abre la galería (o el selector de archivos en el computador)
  const elegirDeGaleria = async () => {
    setSelectorVisible(false);
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: quedan,
      quality: 0.5,
    });
    if (resultado.canceled) return;
    const nuevas = resultado.assets.map((a) => a.uri);
    onChange([...fotos, ...nuevas].slice(0, MAX_FOTOS));
  };

  // Abre la cámara del celular
  const tomarFoto = async () => {
    setSelectorVisible(false);
    const permiso = await ImagePicker.requestCameraPermissionsAsync();
    if (!permiso.granted) {
      Alert.alert(
        "Sin permiso para la cámara",
        "Para tomar una foto, permite el uso de la cámara en los ajustes del celular."
      );
      return;
    }
    const resultado = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.5,
    });
    if (resultado.canceled) return;
    onChange([...fotos, resultado.assets[0].uri].slice(0, MAX_FOTOS));
  };

  const pegarImagen = async () => {
    setPasteError("");
    try {
      const imagen = await Clipboard.getImageAsync({ format: "png" });
      if (!imagen) {
        setPasteError("No se encontró una imagen en el portapapeles.");
        return;
      }
      onChange([...fotos, imagen.data].slice(0, MAX_FOTOS));
      setSelectorVisible(false);
    } catch {
      setPasteError("No se pudo pegar la imagen. Revisa los permisos del portapapeles.");
    }
  };

  const handleAdjuntar = () => {
    setPasteError("");
    setSelectorVisible(true);
  };

  const quitarFoto = (index: number) => {
    onChange(fotos.filter((_, i) => i !== index));
  };

  return (
    <View style={{ marginBottom: 14 }}>
      <Text
        className="text-[13px] font-inter text-[#1F2366] mb-1.5 ml-1"
        style={{ fontWeight: "600" }}
      >
        Fotos del problema (opcional)
      </Text>

      {/* Miniaturas de las fotos elegidas */}
      {fotos.length > 0 ? (
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          {fotos.map((uri, index) => (
            <View key={uri + index} style={{ width: 90, height: 90 }}>
              <Image
                source={{ uri }}
                style={{ width: 90, height: 90, borderRadius: 10, backgroundColor: "#F3F4F6" }}
                accessibilityLabel={`Foto ${index + 1}`}
              />
              {/* Botón para quitar la foto */}
              <TouchableOpacity
                onPress={() => quitarFoto(index)}
                accessibilityRole="button"
                accessibilityLabel={`Quitar foto ${index + 1}`}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  position: "absolute",
                  top: -8,
                  right: -8,
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: "#B91C1C",
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: 2,
                  borderColor: "#FFFFFF",
                }}
              >
                <X size={16} color="#FFFFFF" strokeWidth={3} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : null}

      {/* Recuadro para agregar fotos (se esconde al llegar a 3) */}
      {quedan > 0 ? (
        <TouchableOpacity
          onPress={handleAdjuntar}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Adjuntar foto"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            padding: 14,
            borderRadius: 10,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: "#A5A1D6",
            backgroundColor: "#FAFAFE",
          }}
        >
          <Camera size={26} color="#201A7A" strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, color: "#201A7A", fontFamily: "Inter_700Bold", fontWeight: "700" }}>
              {fotos.length === 0 ? "Adjuntar foto" : "Agregar otra foto"}
            </Text>
            <Text style={{ fontSize: 13, color: "#6B7280", fontFamily: "Inter_400Regular", marginTop: 2 }}>
              {fotos.length === 0
                ? "Ayuda al técnico a ver el problema. Máximo 3 fotos."
                : `Puedes agregar ${quedan} ${quedan === 1 ? "foto más" : "fotos más"}.`}
            </Text>
          </View>
        </TouchableOpacity>
      ) : (
        <Text style={{ fontSize: 13, color: "#6B7280", fontFamily: "Inter_400Regular", marginLeft: 4 }}>
          Ya agregaste el máximo de 3 fotos. Toca la X roja para quitar una.
        </Text>
      )}

      <Modal
        visible={selectorVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectorVisible(false)}
      >
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            padding: 24,
            backgroundColor: "rgba(0,0,0,0.45)",
          }}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              padding: 20,
              gap: 10,
              width: "100%",
              maxWidth: 380,
              alignSelf: "center",
            }}
          >
            <Text style={{ color: "#1F2366", fontSize: 17, fontFamily: "Inter_700Bold" }}>
              Adjuntar foto
            </Text>
            <Text style={{ color: "#6B7280", fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 4 }}>
              Elige una opción para agregar una imagen.
            </Text>
            {Platform.OS !== "web" && (
              <TouchableOpacity onPress={tomarFoto} style={actionButtonStyle}>
                <Text style={actionButtonTextStyle}>Tomar foto</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={elegirDeGaleria} style={actionButtonStyle}>
              <Text style={actionButtonTextStyle}>Elegir de la galería</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={pegarImagen} style={actionButtonStyle}>
              <Text style={actionButtonTextStyle}>Pegar imagen</Text>
            </TouchableOpacity>
            {pasteError ? (
              <Text accessibilityRole="alert" style={{ color: "#B91C1C", fontSize: 13 }}>
                {pasteError}
              </Text>
            ) : null}
            <TouchableOpacity
              onPress={() => setSelectorVisible(false)}
              style={{ alignItems: "center", paddingVertical: 10 }}
            >
              <Text style={{ color: "#6B7280", fontSize: 14, fontFamily: "Inter_700Bold" }}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const actionButtonStyle = {
  backgroundColor: "#F3F2FA",
  borderRadius: 10,
  paddingVertical: 13,
  paddingHorizontal: 14,
  alignItems: "center" as const,
};

const actionButtonTextStyle = {
  color: "#201A7A",
  fontSize: 14,
  fontFamily: "Inter_700Bold",
  fontWeight: "700" as const,
};