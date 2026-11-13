"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";
import { logger } from "@/lib/logger";
import { CATEGORIAS } from "@/lib/categorias"; // Asegúrate de que exista este archivo

interface CreateTicketModalProps {
  onClose: () => void;
  onCreated: () => void;
  showAlert: (title: string, message: string, type: "info" | "success" | "warning" | "error") => void;
}

export default function CreateTicketModal({ onClose, onCreated, showAlert }: CreateTicketModalProps) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

  const [newTicket, setNewTicket] = useState({
    sucursalCodigo: "",
    punto_venta: "",
    reportante_nombre: "",
    reportante_cedula: "",
    telefono: "",
    categoria: "",
    descripcion: "",
  });
  
  const [ticketErrors, setTicketErrors] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [buscandoSucursal, setBuscandoSucursal] = useState(false);
  
  const [fotos, setFotos] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Buscar el nombre de la sucursal cuando escribe el código
  useEffect(() => {
    const buscar = async () => {
      if (!newTicket.sucursalCodigo.trim()) {
        setNewTicket(prev => ({ ...prev, punto_venta: "" }));
        return;
      }
      
      setBuscandoSucursal(true);
      try {
        const res = await fetch(`${apiUrl}/auth/sucursales?q=${encodeURIComponent(newTicket.sucursalCodigo)}`, {
          credentials: "include"
        });
        const data = await res.json();
        
        if (Array.isArray(data) && data.length > 0) {
          // Buscar la coincidencia exacta
          const exactMatch = data.find((s: any) => s.documento === newTicket.sucursalCodigo);
          if (exactMatch) {
            setNewTicket(prev => ({ ...prev, punto_venta: exactMatch.nombre }));
          } else {
            setNewTicket(prev => ({ ...prev, punto_venta: "" }));
          }
        } else {
          setNewTicket(prev => ({ ...prev, punto_venta: "" }));
        }
      } catch (error) {
        console.error("Error buscando sucursal", error);
      } finally {
        setBuscandoSucursal(false);
      }
    };

    const timer = setTimeout(buscar, 500);
    return () => clearTimeout(timer);
  }, [newTicket.sucursalCodigo, apiUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      if (fotos.length + newFiles.length > 3) {
        showAlert("Límite excedido", "Solo puedes subir hasta 3 fotos", "warning");
        return;
      }
      setFotos(prev => [...prev, ...newFiles]);
    }
  };

  const removeFoto = (index: number) => {
    setFotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const errs: Record<string, string> = {};
    if (!newTicket.sucursalCodigo.trim()) errs.sucursalCodigo = "Requerido";
    if (!newTicket.punto_venta.trim()) errs.sucursalCodigo = "Sucursal no válida";
    if (!newTicket.reportante_nombre.trim()) errs.reportante_nombre = "Requerido";
    if (!newTicket.reportante_cedula.trim()) errs.reportante_cedula = "Requerido";
    if (!newTicket.descripcion.trim()) errs.descripcion = "Requerido";
    if (!newTicket.categoria.trim()) errs.categoria = "Requerido";

    if (Object.keys(errs).length > 0) {
      setTicketErrors(errs);
      return;
    }

    setTicketErrors({});
    setCreating(true);

    try {
      const uploadedImageNames: string[] = [];

      // Subir fotos a MinIO (con el token CSRF que pide el backend)
            // Subir fotos a MinIO
      if (fotos.length > 0) {
        setUploading(true);
        for (const foto of fotos) {
          const formData = new FormData();
          formData.append("file", foto);

          // api.upload ya maneja el CSRF y el FormData correctamente
          const data = await api.upload<{ key: string }>("/upload/incidente", formData);

          if (data.key) uploadedImageNames.push(data.key);
        }
      }

      // Crear el ticket (usando api.post que ya maneja CSRF)
      await api.post("/incidents", {
        documento: newTicket.sucursalCodigo,
        punto_venta: newTicket.punto_venta,
        telefono: newTicket.telefono,
        descripcion: newTicket.descripcion,
        categoria: newTicket.categoria,
        reportante_nombre: newTicket.reportante_nombre,
        reportante_cedula: newTicket.reportante_cedula,
        imagenes: uploadedImageNames.length > 0 ? uploadedImageNames : undefined,
      });

      onCreated();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("No existe un usuario con ese documento")) {
        setTicketErrors((p) => ({ ...p, sucursalCodigo: "No existe un usuario con ese documento" }));
      } else {
        logger.error("Create ticket error", { error: msg });
        showAlert("Error", msg || "Error al crear ticket", "error");
      }
    } finally {
      setCreating(false);
      setUploading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-[rgba(0,0,0,0.4)] flex items-center justify-center z-[100] overflow-y-auto py-10"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-gray-900 rounded-2xl p-7 w-[520px] shadow-[0_20px_60px_rgba(0,0,0,0.15)]"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 font-inter">
            Abrir Nuevo Ticket
          </h2>
          <button
            onClick={() => { onClose(); setTicketErrors({}); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 cursor-pointer"
          >
            <X size={14} color="#6B7280" strokeWidth={2} />
          </button>
        </div>

        {/* Sucursal y Nombre del Punto */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 font-inter mb-1.5">Código de Sucursal</label>
            <input
              type="text"
              value={newTicket.sucursalCodigo}
              onChange={(e) => { setNewTicket({ ...newTicket, sucursalCodigo: e.target.value }); setTicketErrors((p) => ({ ...p, sucursalCodigo: "" })); }}
              className={`w-full h-11 px-3.5 rounded-lg border ${ticketErrors.sucursalCodigo ? "border-red-500" : "border-gray-300 dark:border-gray-600"} bg-[#F9FAFB] dark:bg-gray-800 text-sm font-inter outline-none`}
              placeholder="Ej: 315"
            />
            {ticketErrors.sucursalCodigo && <p className="text-xs text-red-500 mt-1 font-inter">{ticketErrors.sucursalCodigo}</p>}
            {buscandoSucursal && <p className="text-xs text-blue-500 mt-1 font-inter">Buscando sucursal...</p>}
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 font-inter mb-1.5">Nombre del Punto</label>
            <input
              type="text"
              value={newTicket.punto_venta}
              readOnly
              className="w-full h-11 px-3.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-sm font-inter outline-none text-gray-500 cursor-not-allowed"
              placeholder="Se autocompleta"
            />
          </div>
        </div>

        {/* Datos del Solicitante */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 font-inter mb-1.5">Nombre del Solicitante</label>
            <input
              type="text"
              value={newTicket.reportante_nombre}
              onChange={(e) => { setNewTicket({ ...newTicket, reportante_nombre: e.target.value }); setTicketErrors((p) => ({ ...p, reportante_nombre: "" })); }}
              className={`w-full h-11 px-3.5 rounded-lg border ${ticketErrors.reportante_nombre ? "border-red-500" : "border-gray-300 dark:border-gray-600"} bg-[#F9FAFB] dark:bg-gray-800 text-sm font-inter outline-none`}
              placeholder="Quién reporta"
            />
            {ticketErrors.reportante_nombre && <p className="text-xs text-red-500 mt-1 font-inter">{ticketErrors.reportante_nombre}</p>}
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 font-inter mb-1.5">Cédula del Solicitante</label>
            <input
              type="text"
              value={newTicket.reportante_cedula}
              onChange={(e) => { setNewTicket({ ...newTicket, reportante_cedula: e.target.value }); setTicketErrors((p) => ({ ...p, reportante_cedula: "" })); }}
              className={`w-full h-11 px-3.5 rounded-lg border ${ticketErrors.reportante_cedula ? "border-red-500" : "border-gray-300 dark:border-gray-600"} bg-[#F9FAFB] dark:bg-gray-800 text-sm font-inter outline-none`}
              placeholder="Cédula"
            />
            {ticketErrors.reportante_cedula && <p className="text-xs text-red-500 mt-1 font-inter">{ticketErrors.reportante_cedula}</p>}
          </div>
        </div>

        {/* Teléfono y Categoría */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 font-inter mb-1.5">Teléfono</label>
            <input
              type="text"
              value={newTicket.telefono}
              onChange={(e) => setNewTicket({ ...newTicket, telefono: e.target.value })}
              className="w-full h-11 px-3.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-[#F9FAFB] dark:bg-gray-800 text-sm font-inter outline-none"
              placeholder="Número de contacto"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 font-inter mb-1.5">Tipo de problema</label>
            <select
              value={newTicket.categoria}
              onChange={(e) => { setNewTicket({ ...newTicket, categoria: e.target.value }); setTicketErrors((p) => ({ ...p, categoria: "" })); }}
              className={`w-full h-11 px-3.5 rounded-lg border ${ticketErrors.categoria ? "border-red-500" : "border-gray-300 dark:border-gray-600"} bg-[#F9FAFB] dark:bg-gray-800 text-sm font-inter outline-none`}
            >
              <option value="">Selecciona un tipo</option>
              {CATEGORIAS.map(c => (
                <option key={c.codigo} value={c.codigo}>{c.label}</option>
              ))}
            </select>
            {ticketErrors.categoria && <p className="text-xs text-red-500 mt-1 font-inter">{ticketErrors.categoria}</p>}
          </div>
        </div>

        {/* Descripción */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 font-inter mb-1.5">Descripción</label>
          <textarea
            value={newTicket.descripcion}
            onChange={(e) => { setNewTicket({ ...newTicket, descripcion: e.target.value }); setTicketErrors((p) => ({ ...p, descripcion: "" })); }}
            className={`w-full h-24 px-3.5 py-2 rounded-lg border ${ticketErrors.descripcion ? "border-red-500" : "border-gray-300 dark:border-gray-600"} bg-[#F9FAFB] dark:bg-gray-800 text-sm font-inter outline-none resize-none`}
            placeholder="Describe el problema..."
          />
          {ticketErrors.descripcion && <p className="text-xs text-red-500 mt-1 font-inter">{ticketErrors.descripcion}</p>}
        </div>

        {/* Fotos */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 font-inter mb-1.5">Fotos adjuntas (opcional)</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#F3F0FF] file:text-[#25207E] hover:file:bg-[#E5E0FF]"
          />
          {fotos.length > 0 && (
            <div className="flex gap-2 mt-2">
              {fotos.map((f, i) => (
                <div key={i} className="relative w-16 h-16 rounded border overflow-hidden">
                  <img src={URL.createObjectURL(f)} alt="preview" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeFoto(i)}
                    className="absolute top-0 right-0 bg-red-500 text-white rounded-bl p-0.5"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {creating && (
          <p className="text-sm text-gray-500 font-inter mb-3">
            {uploading ? "Subiendo fotos..." : "Creando ticket..."}
          </p>
        )}

        <div className="flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="h-10 px-[18px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 cursor-pointer text-[13px] font-medium font-inter text-gray-700 dark:text-gray-300"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={creating}
            className="h-10 px-[18px] rounded-lg border-none font-inter text-[13px] font-semibold text-white bg-[#25207E] disabled:bg-[#25207E]/70 disabled:cursor-not-allowed cursor-pointer"
          >
            {creating ? "Creando..." : "Crear Ticket"}
          </button>
        </div>
      </div>
    </div>
  );
}