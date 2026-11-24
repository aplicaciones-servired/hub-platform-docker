import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateTicketModal from "./CreateTicketModal";

// Mock the api module
vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue([{ documento: "315", nombre: "La Virgen" }]),
    post: vi.fn().mockResolvedValue({}),
    upload: vi.fn().mockResolvedValue({ key: "foto.jpg" }),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

// Llena los campos obligatorios y espera a que se autocomplete el punto
async function llenarFormulario() {
  fireEvent.change(screen.getByPlaceholderText("Ej: 315"), {
    target: { value: "315" },
  });
  await waitFor(
    () => expect(screen.getByPlaceholderText("Se autocompleta")).toHaveValue("La Virgen"),
    { timeout: 2000 }
  );
  fireEvent.change(screen.getByPlaceholderText("Quién reporta"), {
    target: { value: "Test User" },
  });
  fireEvent.change(screen.getByPlaceholderText("Cédula"), {
    target: { value: "123456789" },
  });
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "aplicativos" },
  });
  fireEvent.change(screen.getByPlaceholderText("Describe el problema..."), {
    target: { value: "Test description" },
  });
}

describe("CreateTicketModal", () => {
  it("renders modal with form fields", () => {
    render(
      <CreateTicketModal
        onClose={vi.fn()}
        onCreated={vi.fn()}
        showAlert={vi.fn()}
      />
    );

    expect(screen.getByText("Abrir Nuevo Ticket")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ej: 315")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Se autocompleta")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Quién reporta")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Cédula")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Número de contacto")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Describe el problema...")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(
      <CreateTicketModal
        onClose={onClose}
        onCreated={vi.fn()}
        showAlert={vi.fn()}
      />
    );

    const closeButton = container.querySelector('button[class*="w-8 h-8"]');
    if (closeButton) {
      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it("calls onClose when cancel button is clicked", () => {
    const onClose = vi.fn();
    render(
      <CreateTicketModal
        onClose={onClose}
        onCreated={vi.fn()}
        showAlert={vi.fn()}
      />
    );

    const cancelButton = screen.getByRole("button", { name: /cancelar/i });
    fireEvent.click(cancelButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows validation errors when submitting empty form", async () => {
    render(
      <CreateTicketModal
        onClose={vi.fn()}
        onCreated={vi.fn()}
        showAlert={vi.fn()}
      />
    );

    const submitButton = screen.getByRole("button", { name: /crear ticket/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getAllByText("Requerido").length).toBeGreaterThan(0);
    });
  });

  it("calls onCreated when form is submitted successfully", async () => {
    const onCreated = vi.fn();
    const { api } = await import("@/lib/api");

    render(
      <CreateTicketModal
        onClose={vi.fn()}
        onCreated={onCreated}
        showAlert={vi.fn()}
      />
    );

    await llenarFormulario();

    const submitButton = screen.getByRole("button", { name: /crear ticket/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/incidents",
        expect.objectContaining({
          documento: "315",
          punto_venta: "La Virgen",
          categoria: "aplicativos",
          reportante_nombre: "Test User",
          reportante_cedula: "123456789",
        })
      );
      expect(onCreated).toHaveBeenCalledTimes(1);
    });
  });

  it("shows alert when submission fails", async () => {
    const showAlert = vi.fn();
    const { api } = await import("@/lib/api");
    (api.post as any).mockRejectedValueOnce(new Error("API Error"));

    render(
      <CreateTicketModal
        onClose={vi.fn()}
        onCreated={vi.fn()}
        showAlert={showAlert}
      />
    );

    await llenarFormulario();

    const submitButton = screen.getByRole("button", { name: /crear ticket/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(showAlert).toHaveBeenCalledWith("Error", "API Error", "error");
    });
  });
});