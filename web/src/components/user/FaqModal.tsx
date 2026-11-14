"use client";

import { useState } from "react";
import { ChevronDown, X } from "lucide-react";

const FAQS = [
  {
    pregunta: "¿Cómo cerrar sesión de forma segura?",
    respuesta: "Para cerrar sesión, dirígete al menú Perfil o Configuración y selecciona Cerrar sesión. Esto protegerá tu información, especialmente si utilizas un dispositivo compartido.",
  },
  {
    pregunta: "¿Puedo continuar una conversación anterior?",
    respuesta: "Sí. Si la conversación sigue disponible, podrás retomarla desde el historial del chat y continuar con el mismo caso sin necesidad de empezar de nuevo.",
  },
  {
    pregunta: "¿Cómo saber si mi ticket fue recibido?",
    respuesta: "Una vez enviado el reporte, la aplicación mostrará un mensaje de confirmación junto con el número de ticket. Además, podrás consultar su estado en la sección Mis Tickets o Estado de Tickets.",
  },
  {
    pregunta: "La aplicación está lenta, ¿cómo solucionarlo?",
    respuesta: "Si la aplicación presenta lentitud, prueba las siguientes acciones:\n\n• Verifica que tengas una conexión estable a Internet.\n• Cierra y vuelve a abrir la aplicación.\n• Actualiza la aplicación a la última versión disponible.\n• Reinicia tu dispositivo.\n• Si el problema continúa, crea un ticket de soporte indicando el inconveniente para que podamos revisarlo.",
  },
];

interface FaqModalProps {
  onClose: () => void;
}

export function FaqModal({ onClose }: FaqModalProps) {
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="bg-white rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-bold text-[#1F2937]">Preguntas Frecuentes</h2>
        <button onClick={onClose}>
          <X size={22} color="#6B7280" strokeWidth={2} />
        </button>
      </div>

      <div className="flex flex-col gap-2.5">
        {FAQS.map((faq, i) => {
          const isOpen = expanded === i;
          return (
            <div
              key={i}
              className={`border rounded-xl overflow-hidden transition-colors ${
                isOpen ? "border-[#201A7A]" : "border-gray-200"
              }`}
            >
              <button
                onClick={() => setExpanded(isOpen ? null : i)}
                className={`flex items-center justify-between w-full p-3.5 text-left ${
                  isOpen ? "bg-[#EEEDF8]" : "bg-white"
                }`}
              >
                <span
                  className={`flex-1 text-sm font-semibold mr-2 ${
                    isOpen ? "text-[#201A7A]" : "text-[#1F2937]"
                  }`}
                >
                  {faq.pregunta}
                </span>
                <ChevronDown
                  size={18}
                  className={`flex-shrink-0 transition-transform ${
                    isOpen ? "rotate-180 text-[#201A7A]" : "text-gray-400"
                  }`}
                  strokeWidth={2}
                />
              </button>
              {isOpen && (
                <div className="px-3.5 pb-3.5 bg-[#FAFAFE]">
                  <div className="h-px bg-gray-200 mb-2.5" />
                  <p className="text-[13px] text-[#4B5563] leading-relaxed whitespace-pre-line">
                    {faq.respuesta}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        onClick={onClose}
        className="w-full h-11 rounded-lg bg-[#201A7A] text-white text-sm font-semibold mt-3 hover:bg-[#16145e] transition-colors"
      >
        Cerrar
      </button>
    </div>
  );
}
