import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { Alert, Platform } from "react-native";
import { useRouter } from "expo-router";
import {
  api,
  setToken,
  clearToken,
  initToken,
  saveUser,
  getSavedUser,
  setForceLogoutHandler,
  setBlockedHandler,
} from "../services/api";
import { registerForPushNotifications, unregisterForPushNotifications, setupNotificationListeners } from "../services/notifications";
import { logger } from "../services/logger";
import type { AuthUser } from "@hub/shared/types/auth";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  initializing: boolean;
  login: (documento: string, contrasena: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Restore session on app start
  useEffect(() => {
    async function restore() {
      try {
        const token = await initToken();
        // En web el token vive solo en memoria (services/storage.ts), así que un
        // reload lo deja en null aunque la cookie mobile_token siga vigente. La
        // sesión real está en esa cookie httpOnly, que viaja con cada request
        // vía credentials:"include" + X-Auth-Client: mobile, así que hay que
        // preguntarle al servidor siempre. En nativo el token persiste en
        // SecureStore y el gate original se mantiene intacto.
        if (token || Platform.OS === "web") {
          const savedUser = await getSavedUser();
          if (savedUser) {
            setUser(savedUser as AuthUser);
          }
          try {
            const fresh = await api.get<AuthUser>("/auth/me");
            setUser(fresh);
            await saveUser(fresh);
            registerForPushNotifications().catch((err) => {
              logger.warn("Push notification registration failed on restore", { error: (err as Error).message });
            });
            router.replace("/chat");
          } catch (err) {
            const msg = err instanceof Error ? err.message : "";
            if (msg === "Sesión expirada" || msg === "bloqueado") {
              await clearToken();
              setUser(null);
              if (msg === "bloqueado") {
                const originalMsg = (err as { originalMsg?: string }).originalMsg;
                Alert.alert(
                  "Cuenta bloqueada",
                  originalMsg || "Su cuenta ha sido bloqueada. Contacte al administrador."
                );
                router.replace("/");
              }
            } else {
              logger.warn("Auth restore: error no relacionado con sesión, se conserva la sesión local", { error: msg });
            }
          }
        }
      } catch (err) {
        logger.warn("Auth restore error", { error: (err as Error).message });
        await clearToken();
      } finally {
        setInitializing(false);
      }
    }

    restore();
  }, [router]);

  useEffect(() => {
    return setupNotificationListeners((data) => {
      if (data.incidentId) {
        router.push(`/incidente/${data.incidentId}`);
      }
    });
  }, [router]);

  useEffect(() => {
    setForceLogoutHandler(() => {
      setUser(null);
      router.replace("/");
    });

    setBlockedHandler(() => {
      Alert.alert(
        "Cuenta bloqueada",
        "Su cuenta ha sido bloqueada. Contacte al administrador para mas informacion."
      );
    });
  }, [router]);

  const login = useCallback(
    async (documento: string, contrasena: string) => {
      setLoading(true);
      try {
        const data = await api.post<{ user: AuthUser; token: string }>(
          "/auth/login",
          { documento, contrasena, scope: "user" }
        );

        await setToken(data.token);
        await saveUser(data.user);
        setUser(data.user);

        registerForPushNotifications().catch((err) => {
          logger.warn("Push notification registration failed on login", { error: (err as Error).message });
        });
      } catch (err) {
        if (err instanceof Error && err.message === "bloqueado") {
          const originalMsg = (err as { originalMsg?: string }).originalMsg;
          throw new Error(originalMsg || "Usuario bloqueado");
        }
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const logout = useCallback(async () => {
    await unregisterForPushNotifications().catch((err) => {
      logger.warn("Push unregister failed on logout", { error: (err as Error).message });
    });
    await api.post("/auth/logout").catch((err) => {
      logger.warn("Logout API call failed", { error: (err as Error).message });
    });
    await clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, initializing, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
