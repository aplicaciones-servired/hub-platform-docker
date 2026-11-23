"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { BotMessageCard } from "@/components/user/BotMessageCard";
import { ExpandableMenu } from "@/components/user/ExpandableMenu";
import ChatBubble from "@/components/user/ChatBubble";
import ChatInput from "@/components/user/ChatInput";
import { FaqModal } from "@/components/user/FaqModal";
import { Ticket, ArrowRight, ChevronDown } from "lucide-react";

interface SuggestedAction { label: string; action: string }

interface Message {
  id: string;
  type: "bot-card" | "user" | "date";
  text?: string;
  timestamp: string;
  suggestedActions?: SuggestedAction[];
  /** ID del incidente cuando el mensaje del bot es sobre un ticket concreto */
  ticketId?: string;
}

function getTimeString(): string {
  return new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function ChatPage() {
  const router = useRouter();
  const { user, initializing } = useAuth();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([
    { id: "date-1", type: "date", text: "Hoy", timestamp: "" },
  ]);
  const [typing, setTyping] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [latestIncident, setLatestIncident] = useState<{ id: string; descripcion: string; estado: string } | null>(null);
  const [showFaq, setShowFaq] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (!initializing && !user) { router.replace("/user/login"); return; }
    if (initializing) return;

    const welcome: Message = {
      id: "bot-card-welcome",
      type: "bot-card",
      text: "Bienvenido. Soy el asistente de soporte. Seleccione una opción para comenzar:",
      timestamp: getTimeString(),
      suggestedActions: [
        { label: "Reportar un problema", action: "menu_principal" },
        { label: "Ver mi historial", action: "ir_historial" },
      ],
    };

    api.get<{ items: { id: string; content: string; is_bot: boolean; created_at: string; metadata?: { ticketId?: string } | null }[] }>("/chat/history?limit=30")
      .then((history) => {
        const historyMsgs: Message[] = history.items.map((msg) => ({
          id: msg.id,
          type: msg.is_bot ? "bot-card" : "user",
          text: msg.content,
          timestamp: new Date(msg.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: true }),
          ticketId: msg.metadata?.ticketId ?? undefined,
        }));
        setMessages(historyMsgs.length === 0 ? [{ id: "date-1", type: "date", text: "Hoy", timestamp: "" }, welcome] : [{ id: "date-1", type: "date", text: "Hoy", timestamp: "" }, ...historyMsgs]);
      })
      .catch(() => setMessages([{ id: "date-1", type: "date", text: "Hoy", timestamp: "" }, welcome]))
      .finally(() => setLoadingHistory(false));

    api.get<{ items: { id: string; descripcion: string; estado: string }[] }>("/incidents?limit=1")
      .then((data) => { if (data.items.length > 0) setLatestIncident(data.items[0]); })
      .catch((err) => logger.error("Error fetching latest incident", { error: err instanceof Error ? err.message : err }));
  }, [initializing, user, router]);

  useEffect(() => { if (!loadingHistory) scrollToBottom(); }, [messages, loadingHistory]);

  const handleSend = useCallback(async (text: string, displayText?: string) => {
    const userMsg: Message = { id: `user-${Date.now()}`, type: "user", text: displayText || text, timestamp: getTimeString() };
    setMessages((prev) => [...prev, userMsg]);
    setTyping(true);

    try {
      const data = await api.post<{ userMessage: { id: string; content: string }; botMessage: { id: string; content: string }; suggestedActions?: SuggestedAction[]; autoAction?: string; ticketId?: string | null }>("/chat/message", { content: text });
      setTyping(false);

      const botMsg: Message = { id: data.botMessage.id, type: "bot-card", text: data.botMessage.content, timestamp: getTimeString(), suggestedActions: data.suggestedActions, ticketId: data.ticketId ?? undefined };
      setMessages((prev) => [...prev, botMsg]);

      if (data.autoAction) {
        setTimeout(() => {
          if (data.autoAction === "reportar") router.push("/user/reportar");
          else if (data.autoAction === "ir_historial") router.push("/user/historial");
          else if (data.autoAction === "ver_faq") setShowFaq(true);
        }, 1500);
      }
    } catch (err) {
      logger.error("Send message error", { error: (err as Error).message });
      setTyping(false);
      setMessages((prev) => [...prev, { id: `bot-card-${Date.now()}`, type: "bot-card", text: "Ocurrió un error al procesar el mensaje. Selecciona una opción:", timestamp: getTimeString(), suggestedActions: [{ label: "Volver al menú principal", action: "menu_principal" }, { label: "Reportar incidente", action: "reportar" }] }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSuggestedAction = useCallback((action: string, label: string) => {
    if (action === "reportar") router.push("/user/reportar");
    else if (action === "ir_historial") router.push("/user/historial");
    else if (action === "ver_faq") setShowFaq(true);
    else handleSend(action, label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSend]);

  const handleSubmenuPress = useCallback((label: string) => {
    if (label === "Reportar incidente") router.push("/user/reportar");
    else if (label === "Preguntas frecuentes") setShowFaq(true);
    else handleSend(label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSend]);

  const handleMenuPress = useCallback((label: string) => {
    if (label === "Estado de reporte") router.push("/user/historial");
    else handleSend(label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleSend]);

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 150);
  };

  return (
    <div className="flex flex-col h-screen bg-[#F5F5F5]">
      <div className="bg-white border-b border-gray-200 px-5 py-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#EEEDF8] flex items-center justify-center">
          <span className="text-[#25207E] text-sm font-bold">H</span>
        </div>
        <div>
          <h1 className="text-[17px] font-bold text-[#25207E]">HUB AI</h1>
          <p className="text-[11px] text-[#6B7280]">Chatbot corporativo</p>
        </div>
        <div className="ml-auto w-9 h-9 rounded-full bg-[#DCD4FF] flex items-center justify-center">
          <span className="text-[#25207E] text-xs font-bold">
            {user?.nombre?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
          </span>
        </div>
      </div>

      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto py-2"
      >
        {loadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-[3px] border-gray-200 border-t-[#3B348B] rounded-full animate-spin" />
            <p className="ml-3 text-sm text-[#6B7280]">Cargando conversación...</p>
          </div>
        ) : (
          <>
            {latestIncident && (
              <button
                onClick={() => router.push(`/user/incidente/${latestIncident.id}`)}
                className="flex items-center gap-2.5 mx-3.5 mb-2.5 bg-[#EEEDF8] border border-[#DCD4FF] rounded-xl px-3 py-3 w-[calc(100%-28px)] hover:bg-[#E8E4FF] transition-colors"
              >
                <Ticket size={18} color="#25207E" strokeWidth={2} />
                <div className="flex-1 text-left">
                  <p className="text-[12px] font-semibold text-[#25207E]">Tu último ticket</p>
                  <p className="text-[13px] text-[#1F2937] truncate">{latestIncident.descripcion}</p>
                </div>
                <ArrowRight size={14} color="#25207E" strokeWidth={2.5} />
              </button>
            )}

            {messages.map((item) => {
              if (item.type === "date") {
                return (
                  <div key={item.id} className="flex justify-center my-3">
                    <span className="bg-gray-200 text-[#6B7280] text-xs px-4 py-1 rounded-full">{item.text}</span>
                  </div>
                );
              }
              if (item.type === "bot-card") {
                const isResolved = item.text?.includes("ha sido marcado como **Resuelto**") ?? false;
                return (
                  <BotMessageCard
                    key={item.id}
                    message={item.text || ""}
                    timestamp={item.timestamp}
                    suggestedActions={item.suggestedActions}
                    isResolvedNotification={isResolved}
                    onSuggestedAction={handleSuggestedAction}
                    onSubmenuPress={handleSubmenuPress}
                    onMenuPress={handleMenuPress}
                  />
                );
              }
              return (
                <ChatBubble key={item.id} isBot={false} timestamp={item.timestamp}>
                  <p className="text-[15px] text-white leading-relaxed">{item.text}</p>
                </ChatBubble>
              );
            })}

            {typing && (
              <div className="px-4 mb-3">
                <div className="bg-white rounded-2xl border border-gray-200 p-4 w-[90%] flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="w-2.5 h-2.5 rounded-full bg-[#3B348B] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </>
        )}
      </div>

      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-20 right-4 w-10 h-10 rounded-full bg-[#201A7A] flex items-center justify-center shadow-lg hover:bg-[#16145e] transition-colors z-10"
        >
          <ChevronDown size={22} color="#FFFFFF" strokeWidth={2.5} />
        </button>
      )}

      <ChatInput onSend={handleSend} />

      {showFaq && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50" onClick={() => setShowFaq(false)}>
          <FaqModal onClose={() => setShowFaq(false)} />
        </div>
      )}
    </div>
  );
}
