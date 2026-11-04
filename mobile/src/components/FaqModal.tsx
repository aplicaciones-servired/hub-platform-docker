import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { ChevronDown, X } from "lucide-react-native";
import { CATEGORIAS } from "../constants/categorias";

interface FaqItem {
  pregunta: string;
  respuesta: string;
}

// Tiempos de respuesta armados desde la lista de tipos,
// así si cambia un tiempo en categorias.ts, también cambia aquí.
const TIEMPOS = CATEGORIAS.filter((c) => c.tiempo)
  .map((c) => `• ${c.label}: ${c.tiempo}`)
  .join("\n");

const FAQS: FaqItem[] = [
  {
    pregunta: "¿Cómo reporto un problema?",
    respuesta:
      "1. En Inicio, toca \"Reportar incidente\" y elige el tipo de problema.\n" +
      "   También puedes tocar \"Reportar\" en la barra de abajo.\n" +
      "2. Escribe tu nombre completo, tu cédula y revisa tu teléfono.\n" +
      "3. Explica qué pasó, desde cuándo y qué equipo o programa falla.\n" +
      "4. Toca \"Enviar Reporte\".",
  },
  {
    pregunta: "¿Cuánto tardan en responder?",
    respuesta:
      "Depende del tipo de problema:\n\n" +
      TIEMPOS +
      "\n\nSon tiempos aproximados.",
  },
  {
    pregunta: "¿Cómo sé si mi reporte fue recibido?",
    respuesta:
      "Al enviarlo, aparece la pantalla \"¡Reporte Enviado!\" con un número de reporte, por ejemplo #TK-1A2B3C4D.\n\n" +
      "También lo verás en Inicio, en \"Tu último reporte\", y en \"Mis reportes\".",
  },
  {
    pregunta: "¿Cómo veo cómo va mi reporte?",
    respuesta:
      "Toca \"Mis reportes\" en la barra de abajo. Cada reporte muestra su estado:\n\n" +
      "• Pendiente: todavía no lo han revisado.\n" +
      "• En proceso: un técnico ya está trabajando en él.\n" +
      "• Resuelto: el problema fue solucionado.\n\n" +
      "Toca un reporte para ver todos sus datos y la solución.",
  },
  {
    pregunta: "¿Cómo me entero de que ya lo solucionaron?",
    respuesta:
      "Cuando tu reporte se resuelve, aparece un aviso en Inicio, en la sección \"Avisos\", con la solución que dio el técnico. " +
      "También verás el estado \"Resuelto\" en \"Mis reportes\".",
  },
  {
    pregunta: "¿Por qué me piden cédula y teléfono?",
    respuesta:
      "Para saber quién hizo el reporte y poder llamarte si el técnico necesita más información. " +
      "Revisa que tu teléfono esté bien escrito. Si cambió, corrígelo antes de enviar.",
  },
  {
    pregunta: "¿Cómo cierro sesión?",
    respuesta:
      "Toca el ícono rojo que está arriba a la derecha, junto al nombre del punto, y confirma.\n\n" +
      "Hazlo siempre si el celular o el computador lo usan otras personas.",
  },
  {
    pregunta: "¿Dónde aprendo a usar la app?",
    respuesta:
      "Toca \"Capacitación\" en la barra de abajo. Ahí encontrarás videos cortos que explican cada pantalla.",
  },
  {
    pregunta: "La app está lenta o no carga, ¿qué hago?",
    respuesta:
      "1. Revisa que tengas internet.\n" +
      "2. Cierra la app y vuelve a abrirla.\n" +
      "3. Si sigue fallando, reinicia el celular.\n" +
      "4. Si el problema continúa, envía un reporte eligiendo \"Otro problema\".",
  },
];

interface FaqModalProps {
  onClose: () => void;
}

export default function FaqModal({ onClose }: FaqModalProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const toggle = (index: number) => {
    setExpanded(expanded === index ? null : index);
  };

  return (
    <View
      style={{
        backgroundColor: "#FFFFFF",
        borderRadius: 20,
        padding: 24,
        maxHeight: "90%",
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: "#1F2937",
            fontFamily: "Inter_700Bold",
          }}
        >
          Preguntas frecuentes
        </Text>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <X size={22} color="#6B7280" strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {FAQS.map((faq, index) => {
          const isOpen = expanded === index;
          return (
            <View
              key={index}
              style={{
                borderWidth: 1,
                borderColor: isOpen ? "#201A7A" : "#E5E7EB",
                borderRadius: 12,
                marginBottom: 10,
                overflow: "hidden",
              }}
            >
              <TouchableOpacity
                onPress={() => toggle(index)}
                activeOpacity={0.7}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: 14,
                  backgroundColor: isOpen ? "#F3F0FF" : "#FFFFFF",
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontSize: 14,
                    fontWeight: "600",
                    color: isOpen ? "#201A7A" : "#1F2937",
                    fontFamily: "Inter_700Bold",
                    marginRight: 8,
                  }}
                >
                  {faq.pregunta}
                </Text>
                <ChevronDown
                  size={18}
                  color={isOpen ? "#201A7A" : "#9CA3AF"}
                  strokeWidth={2}
                  style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}
                />
              </TouchableOpacity>

              {isOpen && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14, backgroundColor: "#FAFAFE" }}>
                  <View style={{ height: 1, backgroundColor: "#E5E7EB", marginBottom: 10 }} />
                  <Text
                    style={{
                      fontSize: 13,
                      color: "#4B5563",
                      fontFamily: "Inter_400Regular",
                      lineHeight: 20,
                    }}
                  >
                    {faq.respuesta}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <TouchableOpacity
        onPress={onClose}
        activeOpacity={0.85}
        style={{
          height: 46,
          borderRadius: 10,
          backgroundColor: "#201A7A",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 12,
        }}
      >
        <Text
          style={{
            fontSize: 14,
            fontWeight: "600",
            color: "#FFFFFF",
            fontFamily: "Inter_700Bold",
          }}
        >
          Cerrar
        </Text>
      </TouchableOpacity>
    </View>
  );
}
