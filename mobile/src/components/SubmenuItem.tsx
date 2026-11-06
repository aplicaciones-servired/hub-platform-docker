import { TouchableOpacity, Text } from "react-native";

interface SubmenuItemProps {
  label: string;
  onPress: () => void;
}

export default function SubmenuItem({ label, onPress }: SubmenuItemProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        backgroundColor: "#D9D8EC",
        borderRadius: 6,
        minHeight: 44,
        paddingVertical: 10,
        justifyContent: "center",
        paddingHorizontal: 14,
        marginBottom: 6,
        width: "100%",
      }}
    >
      <Text
        style={{
          color: "#4B4F7A",
          fontSize: 15,
          fontFamily: "Inter_400Regular",
          fontWeight: "500",
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
