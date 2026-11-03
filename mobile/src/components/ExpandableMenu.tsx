import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { ChevronDown } from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";
import SubmenuItem from "./SubmenuItem";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface MenuOption {
  label: string;
  subItems?: { label: string }[];
}

const MENU_OPTIONS: MenuOption[] = [
  {
    label: "Soporte t\u00E9cnico",
    subItems: [
      { label: "Reportar incidente" },
      { label: "Preguntas frecuentes" },
    ],
  },
];

interface ExpandableMenuProps {
  onSubmenuPress?: (label: string) => void;
  onMenuPress?: (label: string) => void;
}

export default function ExpandableMenu({
  onSubmenuPress,
  onMenuPress,
}: ExpandableMenuProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const rotation = useSharedValue(0);
  const submenuHeight = useSharedValue(0);
  const submenuOpacity = useSharedValue(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const submenuAnimStyle = useAnimatedStyle(() => ({
    height: submenuHeight.value,
    opacity: submenuOpacity.value,
    overflow: "hidden" as const,
  }));

  const handleSelect = useCallback((label: string) => {
    if (selected === label) {
      LayoutAnimation.configureNext(
        LayoutAnimation.create(250, "easeInEaseOut", "opacity")
      );
      setSelected(null);
      rotation.value = withTiming(0, { duration: 250, easing: Easing.ease });
      submenuOpacity.value = withTiming(0, { duration: 200, easing: Easing.ease });
      submenuHeight.value = withTiming(0, { duration: 250, easing: Easing.ease });
      return;
    }

    const option = MENU_OPTIONS.find((o) => o.label === label);
    if (!option) return;

    LayoutAnimation.configureNext(
      LayoutAnimation.create(250, "easeInEaseOut", "opacity")
    );
    setSelected(label);

    if (option.subItems) {
      setTimeout(() => {
        if (!mountedRef.current) return;
        rotation.value = withTiming(180, {
          duration: 250,
          easing: Easing.ease,
        });
        submenuOpacity.value = withTiming(1, {
          duration: 200,
          easing: Easing.ease,
        });
        submenuHeight.value = withTiming(144, {
          duration: 250,
          easing: Easing.ease,
        });
      }, 260);
    } else {
      onMenuPress?.(label);
    }
  }, [selected, onMenuPress]);

  const handleSubmenuPress = (label: string) => {
    onSubmenuPress?.(label);
  };

  const selectedOption = MENU_OPTIONS.find((o) => o.label === selected);

  return (
    <View style={{ marginTop: 12 }}>
      {selectedOption && (
        <View style={{ marginBottom: 4 }}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={{
              backgroundColor: "#201A7A",
              borderRadius: 8,
              height: 44,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 15,
                fontFamily: "Inter_400Regular",
                fontWeight: "500",
                marginRight: selectedOption.subItems ? 8 : 0,
              }}
            >
              {selectedOption.label}
            </Text>
            {selectedOption.subItems && (
              <Animated.View style={chevronStyle}>
                <ChevronDown size={18} color="#FFFFFF" strokeWidth={2.5} />
              </Animated.View>
            )}
          </TouchableOpacity>

          {selectedOption.subItems && (
            <Animated.View style={submenuAnimStyle}>
              <View style={{ flexDirection: "row", marginTop: 10 }}>
                <View
                  style={{
                    width: 3,
                    backgroundColor: "#D9D9E8",
                    borderRadius: 2,
                    marginRight: 14,
                  }}
                />
                <View style={{ flex: 1 }}>
                  {selectedOption.subItems.map((item) => (
                    <SubmenuItem
                      key={item.label}
                      label={item.label}
                      onPress={() => handleSubmenuPress(item.label)}
                    />
                  ))}
                </View>
              </View>
            </Animated.View>
          )}
        </View>
      )}

      {selected === null &&
        MENU_OPTIONS.map((option, index) => (
          <TouchableOpacity
            key={option.label}
            onPress={() => handleSelect(option.label)}
            activeOpacity={0.8}
            style={{
              backgroundColor: "#201A7A",
              borderRadius: 8,
              height: 44,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              marginTop: index > 0 ? 8 : 0,
            }}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 15,
                fontFamily: "Inter_400Regular",
                fontWeight: "500",
              }}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        )
      )}
    </View>
  );
}
