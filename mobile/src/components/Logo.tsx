import { View, Image, Text } from "react-native";

const LOGO_SOURCE = (() => {
  try {
    return require("../../assets/logo.png");
  } catch {
    return null;
  }
})();

const LOGO_ASPECT = 648 / 189;

interface LogoProps {
  size?: number;
}

export default function Logo({ size = 72 }: LogoProps) {
  const imageHeight = size;
  const imageWidth = Math.round(size * LOGO_ASPECT);

  if (LOGO_SOURCE) {
    return (
      <Image
        source={LOGO_SOURCE}
        style={{
          width: imageWidth,
          height: imageHeight,
          alignSelf: "center",
        }}
        resizeMode="contain"
      />
    );
  }

  return (
    <View
      style={{
        width: imageWidth,
        height: imageHeight,
        backgroundColor: "#3B348B",
        borderRadius: imageHeight * 0.15,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: "#FFFFFF",
          fontSize: imageHeight * 0.4,
          fontFamily: "Inter_700Bold",
        }}
      >
        HUB
      </Text>
    </View>
  );
}
