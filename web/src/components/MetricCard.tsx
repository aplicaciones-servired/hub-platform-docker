import type { ReactNode } from "react";

interface MetricCardProps {
  icon: ReactNode;
  title: string;
  value: string;
}

export default function MetricCard({ icon, title, value }: MetricCardProps) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 w-full min-h-[130px] flex flex-col justify-center gap-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="w-10 h-10 rounded-[10px] bg-[#EEEDF8] dark:bg-[#EEEDF8]/10 flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="m-0 text-[13px] font-medium text-gray-500 dark:text-gray-400 font-inter">
          {title}
        </p>
        <p className="m-0 mt-0.5 text-[28px] font-bold text-gray-900 dark:text-gray-100 font-inter">
          {value}
        </p>
      </div>
    </div>
  );
}
