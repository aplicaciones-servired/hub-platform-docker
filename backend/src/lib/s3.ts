import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../config/env";

// La conexión se crea la primera vez que se necesita.
// Así la API puede arrancar aunque todavía no tenga las claves de MinIO.
let cliente: S3Client | null = null;

function getCliente(): S3Client {
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) {
    throw new Error("El almacenamiento de imágenes (MinIO) no está configurado");
  }
  if (!cliente) {
    cliente = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: "us-east-1",   // MinIO lo pide aunque no lo use
      forcePathStyle: true,  // Necesario para MinIO: http://servidor:9000/bucket/archivo
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
    });
  }
  return cliente;
}

// Guarda un archivo en el bucket
export async function subirArchivo(key: string, contenido: Buffer, contentType: string): Promise<void> {
  await getCliente().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: contenido,
      ContentType: contentType,
    })
  );
}

// Lee un archivo del bucket (para entregárselo a quien tiene permiso de verlo)
export async function obtenerArchivo(key: string) {
  const respuesta = await getCliente().send(
    new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key })
  );
  return { contenido: respuesta.Body, contentType: respuesta.ContentType };
}