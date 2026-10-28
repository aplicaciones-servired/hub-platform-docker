import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TicketTable from "./TicketTable";

const mockTickets = [
  {
    id: "1",
    asunto: "Test Issue",
    categoria: "Test Category",
    solicitante: "John Doe",
    estado: "Abierto",
    createdAt: "2024-01-01",
    fechaCierre: null,
    agente: "Técnico Uno",
  },
  {
    id: "2",
    asunto: "Another Issue",
    categoria: "Another Category",
    solicitante: "Jane Doe",
    estado: "En Proceso",
    createdAt: "2024-01-02",
    fechaCierre: null,
    agente: null,
  },
];

describe("TicketTable", () => {
  it("renders table with tickets", () => {
    render(
      <TicketTable
        tickets={mockTickets}
        onStatusChange={vi.fn()}
        onViewDetail={vi.fn()}
        onAssignAgent={vi.fn()}
      />
    );
    
    expect(screen.getByText("Test Issue")).toBeInTheDocument();
    expect(screen.getByText("Another Issue")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("Técnico Uno")).toBeInTheDocument();
    expect(screen.getByText("Sin asignar")).toBeInTheDocument();
  });

  it("renders action buttons for each ticket", () => {
    render(
      <TicketTable
        tickets={mockTickets}
        onStatusChange={vi.fn()}
        onViewDetail={vi.fn()}
        onAssignAgent={vi.fn()}
      />
    );
    
    const actionButtons = screen.getAllByRole("button");
    expect(actionButtons.length).toBeGreaterThan(0);
  });

  it("renders empty state when no tickets", () => {
    render(
      <TicketTable
        tickets={[]}
        onStatusChange={vi.fn()}
        onViewDetail={vi.fn()}
        onAssignAgent={vi.fn()}
      />
    );
    
    expect(screen.getByText(/no se encontraron tickets/i)).toBeInTheDocument();
  });

  it("displays correct status badges", () => {
    render(
      <TicketTable
        tickets={mockTickets}
        onStatusChange={vi.fn()}
        onViewDetail={vi.fn()}
        onAssignAgent={vi.fn()}
      />
    );
    
    expect(screen.getByText("Abierto")).toBeInTheDocument();
    expect(screen.getByText("En Proceso")).toBeInTheDocument();
  });

  it("displays ticket IDs", () => {
    render(
      <TicketTable
        tickets={mockTickets}
        onStatusChange={vi.fn()}
        onViewDetail={vi.fn()}
        onAssignAgent={vi.fn()}
      />
    );
    
    expect(screen.getByText("#TK-1")).toBeInTheDocument();
    expect(screen.getByText("#TK-2")).toBeInTheDocument();
  });
});
