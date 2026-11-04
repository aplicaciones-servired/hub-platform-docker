import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProviderWrapper } from "../src/components/SafeAreaProviderWrapper";
import { AuthProvider } from "../src/contexts/AuthContext";
import { ConnectivityProvider } from "../src/contexts/ConnectivityContext";
import { OfflineBanner } from "../src/components/OfflineBanner";
import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { initCrashReporting } from "../src/services/crashReporting";
import "../global.css";

initCrashReporting();

try { SplashScreen.preventAutoHideAsync(); } catch {}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!fontsLoaded) return;
    const prepare = async () => {
      await SplashScreen.hideAsync().catch(() => {});
      setIsReady(true);
    };
    prepare();
  }, [fontsLoaded]);

  if (!fontsLoaded || !isReady) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView className="flex-1">
        <SafeAreaProviderWrapper>
          <ConnectivityProvider>
            <AuthProvider>
              <StatusBar style="dark" />
              <OfflineBanner />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="chat" />
                <Stack.Screen name="reportar" />
                <Stack.Screen name="historial" />
                <Stack.Screen name="capacitacion" />
                <Stack.Screen name="exito" />
                <Stack.Screen name="incidente/[id]" />
              </Stack>
            </AuthProvider>
          </ConnectivityProvider>
        </SafeAreaProviderWrapper>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
