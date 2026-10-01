import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  eslint: {
    ignoreDuringBuilds: false,
  },
  async rewrites() {
    // `??` no basta: si la variable está definida pero vacía (o es una ruta
    // relativa como "api"), `??` la deja pasar y Next aborta el build con
    // "Invalid rewrite found" porque el destino no empieza por /, http:// o
    // https://. Se valida el formato en vez de confiar en el valor.
    const raw = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
    const apiBase = /^https?:\/\//.test(raw) ? raw : "http://api:3001/api";
    if (raw && !/^https?:\/\//.test(raw)) {
      console.warn(
        `[next.config] NEXT_PUBLIC_API_URL="${raw}" no es una URL absoluta; se usa ${apiBase}`,
      );
    }
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
