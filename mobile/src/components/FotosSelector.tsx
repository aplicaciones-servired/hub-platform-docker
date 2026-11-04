import { View, Text, TouchableOpacity, Image, Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Camera, X } from "lucide-react-native";

const MAX_FOTOS = 3;

interface FotosSelectorProps {
  fotos: string[];                        // Fotos elegidas (dirección local de cada una)
  onChange: (fotos: string[]) => void;    // Se ejecuta al agregar o quitar fotos
}

// Recuadro para adjuntar hasta 3 fotos del problema (opcional)
export default function FotosSelector({ fotos, onChange }: FotosSelectorProps) {
  const quedan = MAX_FOTOS - fotos.length;

  // Abre la galería (o el selector de archivos en el computador)
  const elegirDeGaleria = async () => {
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

  // Al tocar el recuadro: en el computador abre los archivos;
  // en el celular pregunta si quiere usar la cámara o la galería
  const handleAdjuntar = () => {
    if (Platform.OS === "web") {
      elegirDeGaleria();
      return;
    }
    Alert.alert("Adjuntar foto", "¿De dónde quieres tomar la foto?", [
      { text: "Tomar foto", onPress: tomarFoto },
      { text: "Elegir de la galería", onPress: elegirDeGaleria },
      { text: "Cancelar", style: "cancel" },
    ]);
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
    </View>
  );
}