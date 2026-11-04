import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const value = (process.env[name] || "").trim();
  if (!value) {
    throw new Error(`${name} es requerida. Define la variable de entorno.`);
  }
  return value;
}

function requireStrongSecret(name: string, minLength: number): string {
  const value = requireEnv(name);
  if (value.length < minLength) {
    throw new Error(
      `${name} debe tener al menos ${minLength} caracteres. Genera uno con: openssl rand -hex 32`
    );
  }
  return value;
}

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = parseInt(value || String(fallback), 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("PORT debe ser un número válido entre 1 y 65535.");
  }
  return parsed;
}

function parsePositiveInt(
  value: string | undefined,
  fallback: number,
  name: string
): number {
  const parsed = parseInt(value || String(fallback), 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new Error(`${name} debe ser un número entero mayor o igual a 1.`);
  }
  return parsed;
}

export const env = {
  DATABASE_URL: requireEnv("DATABASE_URL"),
  JWT_SECRET: requireStrongSecret("JWT_SECRET", 32),
  JWT_REFRESH_SECRET: requireStrongSecret("JWT_REFRESH_SECRET", 32),
  JWT_EXPIRES_IN: (process.env.JWT_EXPIRES_IN || "1h").trim() || "1h",
  PORT: parsePort(process.env.PORT, 3001),
  NODE_ENV: process.env.NODE_ENV || "development",
  LOG_LEVEL: (process.env.LOG_LEVEL as string) || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  DB_SSL: process.env.DB_SSL === "true",
  DB_SSL_REJECT_UNAUTHORIZED: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false",
  EMAIL_DOMAIN: process.env.EMAIL_DOMAIN || "hub.ai",
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  MAX_LOGIN_ATTEMPTS: parsePositiveInt(process.env.MAX_LOGIN_ATTEMPTS, 5, "MAX_LOGIN_ATTEMPTS"),
  EXPO_ACCESS_TOKEN: process.env.EXPO_ACCESS_TOKEN || "",
  S3_ENDPOINT: process.env.S3_ENDPOINT || "",
  S3_BUCKET: process.env.S3_BUCKET || "imagenes-soporte",
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || "",
  S3_SECRET_KEY: process.env.S3_SECRET_KEY || "",
  EXTERNAL_SYSTEMS_URL: process.env.EXTERNAL_SYSTEMS_URL || "",
  ALLOWED_HOSTS: (process.env.ALLOWED_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
};
