import { Ticket, AlertCircle, Loader, CheckCircle } from "lucide-react";

interface SummaryCard {
  icon: typeof Ticket;
  title: string;
  value: string;
  iconBg: string;
  iconColor: string;
}

interface TicketSummaryCardsProps {
  total: number;
  pendientes: number;
  enProceso: number;
  resueltos: number;
  loading: boolean;
}

export default function TicketSummaryCards({
  total,
  pendientes,
  enProceso,
  resueltos,
  loading,
}: TicketSummaryCardsProps) {
  const cards: SummaryCard[] = [
    {
      icon: Ticket,
      title: "Total Tickets",
      value: loading ? "..." : total.toLocaleString(),
      iconBg: "bg-[#EEEDF8]",
      iconColor: "#25207E",
    },
    {
      icon: AlertCircle,
      title: "Pendientes",
      value: loading ? "..." : pendientes.toLocaleString(),
      iconBg: "bg-red-100",
      iconColor: "#DC2626",
    },
    {
      icon: Loader,
      title: "En Proceso",
      value: loading ? "..." : enProceso.toLocaleString(),
      iconBg: "bg-[#EEEDF8]",
      iconColor: "#25207E",
    },
    {
      icon: CheckCircle,
      title: "Resueltos",
      value: loading ? "..." : resueltos.toLocaleString(),
      iconBg: "bg-[#EEEDF8]",
      iconColor: "#25207E",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 mb-7">
      {cards.map((card) => (
        <div
          key={card.title}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-[18px] min-h-[120px] flex flex-col justify-center gap-2.5"
        >
          <div
            className={`w-[38px] h-[38px] rounded-[10px] flex items-center justify-center ${card.iconBg}`}
          >
            <card.icon size={19} color={card.iconColor} strokeWidth={2} />
          </div>
          <div>
            <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400 font-inter">
              {card.title}
            </p>
            <p className="text-[32px] font-bold text-gray-900 dark:text-white font-inter leading-none mt-1">
              {card.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
