import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { Ticket, ArrowRight, ChevronDown } from "lucide-react-native";
import AppHeader from "../components/AppHeader";
import BotMessageCard from "../components/BotMessageCard";
import ChatBubble from "../components/ChatBubble";
import TypingIndicator from "../components/TypingIndicator";
import ChatInput from "../components/ChatInput";
import FaqModal from "../components/FaqModal";
import BottomTab from "../components/BottomTab";
import { api } from "../services/api";
import { logger } from "../services/logger";
import { useAuth } from "../contexts/AuthContext";

interface SuggestedAction {
  label: string;
  action: string;
}

// Secuencia para IDs de mensajes únicos (Date.now() solo colisiona en envíos rápidos)
let msgSeq = 0;
function nextMsgId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++msgSeq}`;
}

interface Message {
  id: string;
  type: "bot-card" | "user" | "date" | "typing";
  text?: string;
  timestamp: string;
  suggestedActions?: SuggestedAction[];
  /** ID del incidente cuando el mensaje del bot es sobre un ticket concreto */
  ticketId?: string;
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: "date-1",
    type: "date",
    text: "Hoy",
    timestamp: "",
  },
];

function getTimeString(): string {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  const m = minutes.toString().padStart(2, "0");
  return `${h}:${m} ${ampm}`;
}

export default function ChatScreen() {
  const router = useRouter();
  const { user, initializing } = useAuth();
  const flatListRef = useRef<FlatList<Message>>(null);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [typing, setTyping] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "chatbot" | "reportar" | "historial"
  >("chatbot");
  const [latestIncident, setLatestIncident] = useState<{
    id: string;
    descripcion: string;
    estado: string;
  } | null>(null);
  const [showFaq, setShowFaq] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const autoActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (initializing) return;
    if (!user) {
      router.replace("/");
      return;
    }

    const welcome: Message = {
      id: "bot-card-welcome",
      type: "bot-card",
      text: "Bienvenido. Soy el asistente de soporte. Seleccione una opcion para comenzar:",
      timestamp: getTimeString(),
      suggestedActions: [
        { label: "Reportar un problema", action: "menu_principal" },
        { label: "Ver mi historial", action: "ir_historial" },
      ],
    };

    api
      .get<{ items: { id: string; content: string; is_bot: boolean; created_at: string; metadata?: { ticketId?: string } | null }[] }>("/chat/history?limit=30")
      .then((history) => {
        const historyMsgs: Message[] = (history.items ?? []).map((msg) => ({
          id: msg.id,
          type: msg.is_bot ? ("bot-card" as const) : ("user" as const),
          text: msg.content,
          timestamp: new Date(msg.created_at).toLocaleTimeString("es-CO", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }),
          ticketId: msg.metadata?.ticketId ?? undefined,
        }));

        if (historyMsgs.length === 0) {
          setMessages([...INITIAL_MESSAGES, welcome]);
        } else {
          setMessages([...INITIAL_MESSAGES, ...historyMsgs]);
        }
      })
      .catch((err) => {
        logger.error("Chat history error", { error: err instanceof Error ? err.message : err });
        setMessages([...INITIAL_MESSAGES, welcome]);
      })
      .finally(() => setLoadingHistory(false));

    api
      .get<{ items: { id: string; descripcion: string; estado: string }[] }>(
        "/incidents?limit=1"
      )
      .then((data) => {
        if (data.items.length > 0) {
          setLatestIncident(data.items[0]);
        }
      })
      .catch((err) => {
        logger.error("Latest incident fetch error", { error: err instanceof Error ? err.message : err });
      });
  }, [initializing, user, router]);

  useEffect(() => {
    return () => {
      if (autoActionTimerRef.current) {
        clearTimeout(autoActionTimerRef.current);
      }
    };
  }, []);

  const handleSend = useCallback(async (text: string, displayText?: string) => {
    const userMsg: Message = {
      id: nextMsgId("user"),
      type: "user",
      text: displayText || text,
      timestamp: getTimeString(),
    };

    setMessages((prev) => [...prev.filter((m) => m.type !== "typing"), userMsg]);
    setTyping(true);

    try {
      const data = await api.post<{
        userMessage: { id: string; content: string };
        botMessage: { id: string; content: string };
        suggestedActions?: SuggestedAction[];
        autoAction?: string;
        ticketId?: string | null;
      }>("/chat/message", { content: text });

      setTyping(false);

      const botMsg: Message = {
        id: data.botMessage.id,
        type: "bot-card",
        text: data.botMessage.content,
        timestamp: getTimeString(),
        suggestedActions: data.suggestedActions,
        ticketId: data.ticketId ?? undefined,
      };

      setMessages((prev) => [...prev, botMsg]);

      if (data.autoAction) {
        autoActionTimerRef.current = setTimeout(() => {
          switch (data.autoAction) {
            case "reportar":
              router.push("/reportar");
              break;
            case "ir_historial":
              router.push("/historial");
              break;
            case "ver_faq":
              setShowFaq(true);
              break;
          }
        }, 1500);
      }
    } catch (err) {
      logger.error("ChatScreen sendMessage error", { error: (err as Error).message });
      setTyping(false);

      const errorMsg: Message = {
        id: nextMsgId("bot-card"),
        type: "bot-card",
        text: "Ocurrio un error al procesar el mensaje. Selecciona una opcion:",
        timestamp: getTimeString(),
        suggestedActions: [
          { label: "Volver al menu principal", action: "menu_principal" },
          { label: "Reportar incidente", action: "reportar" },
        ],
      };

      setMessages((prev) => [...prev, errorMsg]);
    }
  }, [router]);

  const handleSuggestedAction = useCallback(
    (action: string, label: string) => {
      switch (action) {
        case "reportar":
          router.push("/reportar");
          break;
        case "ir_historial":
          router.push("/historial");
          break;
        case "ver_faq":
          setShowFaq(true);
          break;
        case "menu_principal":
          handleSend(action, label);
          break;
        default:
          handleSend(action, label);
          break;
      }
    },
    [router, handleSend]
  );

  const handleSubmenuPress = useCallback(
    (label: string) => {
      if (label === "Reportar incidente") {
        router.push("/reportar");
      } else if (label === "Preguntas frecuentes") {
        setShowFaq(true);
      } else {
        handleSend(label);
      }
    },
    [router, handleSend]
  );

  const handleMenuPress = useCallback(
    (label: string) => {
      if (label === "Estado de reporte") {
        router.push("/historial");
      } else {
        handleSend(label);
      }
    },
    [router, handleSend]
  );

  const renderItem = useCallback(
    ({ item }: { item: Message }) => {
      if (item.type === "date") {
        return (
          <View style={{ alignItems: "center", marginVertical: 12 }}>
            <View
              style={{
                backgroundColor: "#E5E7EB",
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 4,
              }}
            >
              <Text
                style={{
                  fontSize: 13,
                  color: "#6B7280",
                  fontFamily: "Inter_400Regular",
                }}
              >
                {item.text}
              </Text>
            </View>
          </View>
        );
      }

      if (item.type === "bot-card") {
        const isResolved = item.text?.includes("ha sido marcado como **Resuelto**") ?? false;
        return (
          <BotMessageCard
            message={item.text || ""}
            timestamp={item.timestamp}
            onSubmenuPress={handleSubmenuPress}
            onMenuPress={handleMenuPress}
            onSuggestedAction={handleSuggestedAction}
            suggestedActions={item.suggestedActions}
            isResolvedNotification={isResolved}
          />
        );
      }

      if (item.type === "typing") {
        return <TypingIndicator />;
      }

      return (
        <ChatBubble isBot={false} timestamp={item.timestamp}>
          <Text
            style={{
              fontSize: 15,
              color: "#FFFFFF",
              fontFamily: "Inter_400Regular",
              lineHeight: 22,
            }}
          >
            {item.text}
          </Text>
        </ChatBubble>
      );
    },
    [handleSubmenuPress, handleSend, handleSuggestedAction, latestIncident]
  );

  const msgList = typing
    ? [
        ...messages,
        { id: "typing", type: "typing" as const, text: "", timestamp: "" },
      ]
    : messages;

  return (
    <View style={{ flex: 1, backgroundColor: "#F5F5F5" }}>
      <AppHeader
        title="Asistente virtual de soporte"
        subtitle="Elige una opción o escribe tu problema"
      />

      <View style={{ flex: 1 }}>
        {loadingHistory ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ActivityIndicator size="large" color="#3B348B" />
            <Text
              style={{
                marginTop: 12,
                color: "#6B7280",
                fontFamily: "Inter_400Regular",
              }}
            >
              Cargando conversación...
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={msgList}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingVertical: 8, paddingBottom: 8 }}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              const distanceFromBottom = contentSize.height - contentOffset.y - layoutMeasurement.height;
              setShowScrollBtn(distanceFromBottom > 150);
            }}
            scrollEventThrottle={200}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              latestIncident ? (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() =>
                    router.push(`/incidente/${latestIncident.id}`)
                  }
                  style={{
                    backgroundColor: "#F3F0FF",
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: "#DCD4FF",
                    marginHorizontal: 14,
                    marginBottom: 10,
                    padding: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Ticket size={18} color="#25207E" strokeWidth={2} />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "600",
                        color: "#25207E",
                        fontFamily: "Inter_700Bold",
                      }}
                    >
                      Tu último ticket
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: "#1F2937",
                        fontFamily: "Inter_400Regular",
                        marginTop: 2,
                      }}
                      numberOfLines={1}
                    >
                      {latestIncident.descripcion}
                    </Text>
                  </View>
                  <ArrowRight size={14} color="#25207E" strokeWidth={2.5} />
                </TouchableOpacity>
              ) : null
            }
          />
        )}

        <Modal
          visible={showFaq}
          transparent
          animationType="fade"
          onRequestClose={() => setShowFaq(false)}
        >
          <View
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.5)",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <FaqModal onClose={() => setShowFaq(false)} />
          </View>
        </Modal>

        {showScrollBtn && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => flatListRef.current?.scrollToEnd({ animated: true })}
            style={{
              position: "absolute",
              bottom: 72,
              right: 16,
              backgroundColor: "#201A7A",
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 4,
              elevation: 4,
            }}
          >
            <ChevronDown size={22} color="#FFFFFF" strokeWidth={2.5} />
          </TouchableOpacity>
        )}

        <ChatInput onSend={handleSend} />

        <BottomTab
          activeTab={activeTab}
           onTabChange={(tab) => {
            if (tab === "reportar") {
              router.push("/reportar");
              return;
            }
            if (tab === "historial") {
              router.push("/historial");
              return;
            }
            if (tab === "ajustes") {
              router.push("/ajustes");
              return;
            }
            setActiveTab(tab);
          }}
        />
      </View>
    </View>
  );
}
