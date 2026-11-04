import { View, Text, TouchableOpacity } from "react-native";
import { Home, AlertTriangle, History, GraduationCap, LucideIcon } from "lucide-react-native";

interface Tab {
  label: string;
  icon: LucideIcon;
  active: boolean;
  onPress: () => void;
}

function TabItem({ label, icon: Icon, active, onPress }: Tab) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 10,
        backgroundColor: active ? "#EEEDF8" : "transparent",
        borderRadius: 12,
        marginHorizontal: 4,
        marginVertical: 4,
      }}
    >
      <Icon
        size={22}
        color={active ? "#1F2366" : "#6B7280"}
        strokeWidth={active ? 2.5 : 2}
      />
      <Text
        style={{
          fontSize: 11,
          fontFamily: "Inter_400Regular",
          color: active ? "#1F2366" : "#6B7280",
          marginTop: 2,
          fontWeight: active ? "600" : "400",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

interface BottomTabProps {
  activeTab: "chatbot" | "reportar" | "historial" | "capacitacion";
  onTabChange: (tab: "chatbot" | "reportar" | "historial" | "capacitacion") => void;
  safeBottom?: number;
}

export default function BottomTab({ activeTab, onTabChange, safeBottom = 20 }: BottomTabProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: "#FFFFFF",
        borderTopWidth: 1,
        borderTopColor: "#E5E7EB",
        paddingHorizontal: 8,
        paddingBottom: safeBottom,
      }}
    >
      <TabItem
        label="Inicio"
        icon={Home}
        active={activeTab === "chatbot"}
        onPress={() => onTabChange("chatbot")}
      />
      <TabItem
        label="Reportar"
        icon={AlertTriangle}
        active={activeTab === "reportar"}
        onPress={() => onTabChange("reportar")}
      />
      <TabItem
        label="Mis Reportes"
        icon={History}
        active={activeTab === "historial"}
        onPress={() => onTabChange("historial")}
      />

            <TabItem
        label="Capacitación"
        icon={GraduationCap}
        active={activeTab === "capacitacion"}
        onPress={() => onTabChange("capacitacion")}
      />
    </View>
  );
}
