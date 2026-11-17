// Videos de capacitación, guardados en MinIO: bucket imagenes-soporte, carpeta capacitacion/.
// En "archivo" va el nombre exacto del video (ej: "inicio.mp4") y en "duracion" su duración (ej: "2 min").
// Si "archivo" está vacío, el video se muestra como "Próximamente".
export const VIDEOS_CAPACITACION = [
  {
    id: "inicio",
    titulo: "Cómo usar la pantalla de Inicio",
    descripcion: "Conoce el Centro de soporte: cómo pedir ayuda, ver tu último reporte y leer los avisos.",
    duracion: "",
    archivo: "inicio.mp4",
  },
  {
    id: "reportar",
    titulo: "Cómo reportar un problema",
    descripcion: "Paso a paso para elegir el tipo de problema, llenar tus datos y enviar el reporte.",
    duracion: "",
    archivo: "reportar.mp4",
  },
  {
    id: "mis-reportes",
    titulo: "Cómo revisar Mis reportes",
    descripcion: "Aprende a ver el estado de tus reportes y la solución que te dio el técnico.",
    duracion: "",
    archivo: "mis-reportes.mp4",
  },
];