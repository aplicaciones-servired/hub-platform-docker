import { Request, Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { logger } from "../../lib/logger";
import { subirArchivo } from "../../lib/s3";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const MAX_STORAGE_BYTES = 500 * 1024 * 1024;

function hasImageSignature(buffer: Buffer, ext: string): boolean {
  if (ext === ".png") return buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  if (ext === ".jpg" || ext === ".jpeg") return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (ext === ".gif") return buffer.subarray(0, 6).toString("ascii") === "GIF87a" || buffer.subarray(0, 6).toString("ascii") === "GIF89a";
  if (ext === ".webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

let uploadLock: Promise<void> = Promise.resolve();

async function getDirSize(): Promise<number> {
  try {
    const files = await fs.promises.readdir(UPLOAD_DIR);
    let total = 0;
    for (const file of files) {
      try {
        const stat = await fs.promises.stat(path.join(UPLOAD_DIR, file));
        total += stat.size;
      } catch {
        continue;
      }
    }
    return total;
  } catch {
    return 0;
  }
}

export async function uploadFile(req: Request, res: Response): Promise<void> {
  try {
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: "No se envió ningún archivo" });
      return;
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = [".png", ".jpg", ".jpeg", ".gif", ".webp"];

    if (!allowed.includes(ext)) {
      res.status(400).json({ error: "Formato no permitido. Usa: png, jpg, jpeg, gif, webp" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      res.status(400).json({ error: "La imagen no puede superar los 5MB" });
      return;
    }

    if (!hasImageSignature(file.buffer, ext)) {
      res.status(400).json({ error: "El contenido del archivo no coincide con una imagen válida" });
      return;
    }

    let releaseLock!: () => void;
    const prevLock = uploadLock;
    uploadLock = new Promise<void>((resolve) => { releaseLock = resolve; });
    await prevLock;
    try {
      const currentSize = await getDirSize();
      if (currentSize + file.size > MAX_STORAGE_BYTES) {
        res.status(507).json({ error: "Almacenamiento de imágenes lleno. Contacta al administrador." });
        return;
      }

      const filename = `${randomUUID()}${ext}`;
      const filepath = path.join(UPLOAD_DIR, filename);

      await fs.promises.writeFile(filepath, file.buffer);

      const url = `/uploads/${filename}`;

      res.json({ url, filename });
      return;
    } finally {
      releaseLock();
    }
  } catch (error) {
    logger.error("Upload error", { error: (error as Error).message });
    res.status(500).json({ error: "Error al subir el archivo" });
  }
}


// Tipos de foto permitidos. Se reconocen por los primeros bytes del archivo
// (su "firma"), no por el nombre, para que nadie suba otra cosa disfrazada de foto.
const TIPOS_FOTO = [
  { ext: "jpg", contentType: "image/jpeg", esDeEsteTipo: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: "png", contentType: "image/png", esDeEsteTipo: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) },
  { ext: "webp", contentType: "image/webp", esDeEsteTipo: (b: Buffer) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
];

// Recibe UNA foto de un reporte, la guarda en MinIO y devuelve su nombre (key)
export async function subirImagenIncidente(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "No se envió ninguna foto" });
    return;
  }

  const tipo = TIPOS_FOTO.find((t) => t.esDeEsteTipo(file.buffer));
  if (!tipo) {
    res.status(400).json({ error: "Solo se permiten fotos JPG, PNG o WEBP" });
    return;
  }

  // Ej: incidentes/2026/11/3f2a9c1e-....jpg (organizadas por año y mes)
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const key = `incidentes/${ahora.getFullYear()}/${mes}/${randomUUID()}.${tipo.ext}`;

  try {
    await subirArchivo(key, file.buffer, tipo.contentType);
    res.status(201).json({ key });
  } catch (err) {
    logger.error("Error subiendo imagen a MinIO", { error: (err as Error).message });
    res.status(503).json({ error: "No se pudo guardar la foto. Intenta de nuevo." });
  }
}