"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { formatTicketId } from "@/lib/utils";
import { Check, Copy, MessageSquare } from "lucide-react";


export default function ExitoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get("ticketId") || "";
  const userId = ticketId ? formatTicketId(ticketId) : "Ticket no disponible";
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  const handleCopy = () => {
    // `navigator.clipboard` no existe en contexto no seguro (http sin TLS), y
    // acceder a `.writeText` ahí lanza de forma síncrona, fuera del alcance del
    // `.catch`. Por eso el try/catch va alrededor del acceso completo.
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard) {
        setCopyError("El navegador no permite copiar aquí");
        return;
      }
      clipboard.writeText(userId).then(
        () => {
          setCopied(true);
          setCopyError("");
          setTimeout(() => setCopied(false), 2000);
        },
        () => setCopyError("No se pudo copiar")
      );
    } catch {
      setCopyError("El navegador no permite copiar aquí");
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA]">
      <div className="bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#EEEDF8] flex items-center justify-center">
            <span className="text-[#25207E] text-xs font-bold">H</span>
          </div>
          <span className="text-[22px] font-bold text-[#25207E]">CorpSupport</span>
        </div>
        <div className="w-10 h-10 rounded-full bg-[#DCD4FF] flex items-center justify-center">
          <span className="text-[#25207E] text-sm font-bold">?</span>
        </div>
      </div>

      <div className="flex flex-col items-center px-4 pt-6 pb-8">
        <div className="w-24 h-24 rounded-full bg-[#E7EEF9] flex items-center justify-center mb-6 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-[#25207E] flex items-center justify-center">
            <Check size={24} color="#FFFFFF" strokeWidth={3.5} />
          </div>
        </div>

        <h1 className="text-[28px] font-bold text-[#25207E] text-center mb-3">¡Reporte Enviado!</h1>
        <p className="text-[15px] text-[#6B7280] text-center leading-relaxed mb-6 max-w-sm">
          Hemos recibido tu reporte. Un agente técnico revisará los detalles y se pondrá en contacto contigo a través del chat o una llamada en la brevedad.
        </p>

        <div className="bg-white border border-[#D9DCE8] rounded-xl p-4 w-full max-w-sm mb-4 shadow-sm">
          <p className="text-[11px] font-semibold text-[#6B7280] text-center tracking-wider mb-2.5">
            NÚMERO DE TICKET
          </p>
          <div className="bg-[#EEF2FF] rounded-lg flex items-center px-3 py-3 min-h-[48px]">
            <span className="flex-1 text-[22px] font-bold text-[#25207E] break-all">{userId}</span>
            <button onClick={handleCopy} className="p-1 ml-2 flex-shrink-0">
              <Copy size={18} color="#25207E" strokeWidth={2} />
            </button>
          </div>
          {copied && <p className="text-xs text-green-500 text-center mt-2">Copiado ✓</p>}
          {copyError && <p className="text-xs text-red-500 text-center mt-2">{copyError}</p>}
        </div>

        <div className="bg-white border border-[#D9DCE8] rounded-xl p-4 w-full max-w-sm mb-4 shadow-sm">
          <h3 className="text-[15px] font-semibold text-[#1F2937] mb-1.5">¿Necesitas algo más?</h3>
          <p className="text-[13px] text-[#6B7280] leading-relaxed mb-4">
            Puedes seguir hablando con nosotros si necesitas ayuda adicional.
          </p>
          <button
            onClick={() => router.replace("/user/chat")}
            className="w-full h-11 rounded-lg bg-[#25207E] text-white text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#1f1a63] transition-colors"
          >
            <MessageSquare size={16} strokeWidth={2} />
            Regresar al Chat
          </button>
        </div>

        {ticketId && (
          <button
            onClick={() => router.push(`/user/incidente/${ticketId}`)}
            className="w-full max-w-sm h-11 rounded-lg bg-[#DCD4FF] text-[#4B5563] text-sm font-semibold hover:bg-[#C8BEFF] transition-colors"
          >
            Ver detalle del ticket
          </button>
        )}
      </div>
    </div>
  );
}
