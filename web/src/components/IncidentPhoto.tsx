"use client";

import { useEffect, useState } from "react";

interface IncidentPhotoProps {
  imageKey: string;
  alt: string;
}

export default function IncidentPhoto({ imageKey, alt }: IncidentPhotoProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    const scope = window.location.pathname.startsWith("/user") ? "user" : "admin";
    const endpoint = `/api/upload/incidente?key=${encodeURIComponent(imageKey)}`;

    fetch(endpoint, {
      credentials: "include",
      headers: { "X-Auth-Scope": scope },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`No se pudo cargar la imagen (${response.status})`);
        return response.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setImageUrl(objectUrl);
      })
      .catch(() => {
        if (active) setError(true);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [imageKey]);

  if (error) {
    return (
      <div className="w-32 h-32 shrink-0 rounded-lg border border-gray-200 bg-gray-50 dark:bg-gray-800 flex items-center justify-center p-2 text-center text-xs text-gray-500">
        No se pudo cargar la foto
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="w-32 h-32 shrink-0 rounded-lg border border-gray-200 bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-sm text-gray-500">
        Cargando…
      </div>
    );
  }

  return (
    <a
      href={imageUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0"
      title="Clic para abrir en tamaño completo"
    >
      {/* La imagen descargada ya está autenticada y se sirve desde un blob local. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt={alt}
        className="w-32 h-32 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity cursor-pointer shadow-sm"
      />
    </a>
  );
}
