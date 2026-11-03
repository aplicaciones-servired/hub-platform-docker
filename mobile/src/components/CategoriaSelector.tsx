import { View, Text, TouchableOpacity } from "react-native";
import { CATEGORIAS } from "../constants/categorias";

interface CategoriaSelectorProps {
  value: string;                       // Código del tipo elegido ("" si no hay)
  onChange: (codigo: string) => void;  // Se ejecuta al tocar un tipo
  error?: string;                      // Mensaje si no eligió ninguno
}

// Lista de botones grandes para elegir el tipo de problema.
// Se usan botones en vez de una lista desplegable porque son más fáciles de tocar y leer.
export default function CategoriaSelector({ value, onChange, error }: CategoriaSelectorProps) {
  return (
    <View className="mb-[14px] w-full">
      <Text
        className="text-[13px] font-inter text-[#1F2366] mb-1.5 ml-1"
        style={{ fontWeight: "600" }}
      >
        Tipo de problema
      </Text>

      {CATEGORIAS.map((categoria) => {
        const elegido = categoria.codigo === value;
        return (
          <TouchableOpacity
            key={categoria.codigo}
            onPress={() => onChange(categoria.codigo)}
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityState={{ selected: elegido }}
            style={{
              minHeight: 48,
              paddingVertical: 12,
              paddingHorizontal: 14,
              marginBottom: 8,
              borderRadius: 10,
              borderWidth: elegido ? 2 : 1,
              borderColor: elegido ? "#201A7A" : "#D1D5DB",
              backgroundColor: elegido ? "#EEEDF8" : "#FFFFFF",
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            {/* Círculo que se rellena cuando el tipo está elegido */}
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 10,
                borderWidth: 2,
                borderColor: elegido ? "#201A7A" : "#9CA3AF",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 12,
              }}
            >
              {elegido ? (
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#201A7A" }} />
              ) : null}
            </View>

            <Text
              style={{
                flex: 1,
                fontSize: 15,
                color: elegido ? "#201A7A" : "#1F2937",
                fontFamily: elegido ? "Inter_700Bold" : "Inter_400Regular",
              }}
            >
              {categoria.label}
            </Text>
          </TouchableOpacity>
        );
      })}

      {error ? (
        <Text className="text-red-500 text-xs mt-1 ml-1 font-inter">{error}</Text>
      ) : null}
    </View>
  );
}