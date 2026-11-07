import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Platform, Text, View, type ImageStyle } from "react-native";
import { API_URL } from "../services/api";
import { getSavedToken } from "../services/storage";

interface IncidentPhotoProps {
  imageKey: string;
  style: ImageStyle;
}

export default function IncidentPhoto({ imageKey, style }: IncidentPhotoProps) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    const endpoint = `${API_URL}/upload/incidente?key=${encodeURIComponent(imageKey)}`;

    async function loadImage() {
      try {
        const headers: Record<string, string> = {
          "X-Auth-Scope": "user",
          "X-Auth-Client": "mobile",
        };

        if (Platform.OS !== "web") {
          const token = await getSavedToken();
          if (!token) throw new Error("No hay una sesión activa para cargar la imagen");
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(endpoint, {
          headers,
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`No se pudo cargar la imagen (${response.status})`);
        }

        const blob = await response.blob();
        if (Platform.OS === "web") {
          objectUrl = URL.createObjectURL(blob);
          if (active) setImageUri(objectUrl);
        } else if (active) {
          const reader = new FileReader();
          reader.onload = () => {
            if (active && typeof reader.result === "string") setImageUri(reader.result);
          };
          reader.onerror = () => {
            if (active) setError(true);
          };
          reader.readAsDataURL(blob);
        }
      } catch {
        if (active) setError(true);
      }
    }

    loadImage();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageKey]);

  if (error) {
    return (
      <View style={[style, { alignItems: "center", justifyContent: "center", padding: 8 }]}>
        <Text style={{ color: "#6B7280", textAlign: "center", fontSize: 12 }}>
          No se pudo cargar la foto
        </Text>
      </View>
    );
  }

  if (!imageUri) {
    return (
      <View style={[style, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color="#3B348B" />
      </View>
    );
  }

  return <Image source={{ uri: imageUri }} style={style} resizeMode="cover" />;
}
