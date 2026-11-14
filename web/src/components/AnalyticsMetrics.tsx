"use client";

import type { LucideIcon } from "lucide-react";

interface Metric {
  icon: LucideIcon;
  title: string;
  value: string;
  desc: string;
}

interface AnalyticsMetricsProps {
  metrics: Metric[];
}

export default function AnalyticsMetrics({ metrics }: AnalyticsMetricsProps) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-7">
      {(Array.isArray(metrics) ? metrics : []).map((metric) => (
        <div
          key={metric.title}
          className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-[18px] min-h-[120px] flex flex-col justify-center gap-2"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#EEEDF8] flex items-center justify-center">
              <metric.icon size={16} color="#25207E" strokeWidth={2} />
            </div>
            <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400 font-inter">
              {metric.title}
            </span>
          </div>
          <p className="text-[28px] font-bold text-gray-900 dark:text-white font-inter">
            {metric.value}
          </p>
          <p className="text-xs text-gray-400 font-inter">
            {metric.desc}
          </p>
        </div>
      ))}
    </div>
  );
}
