import { Activity } from "lucide-react";

interface SensorCardProps {
  title: string;
  value: number;
  unit: string;
  icon?: React.ReactNode;
  status?: "normal" | "warning" | "alert";
  timestamp?: string;
}

export function SensorCard({ title, value, unit, icon, status = "normal", timestamp }: SensorCardProps) {
  const statusBadges = {
    normal: { bg: "bg-green-100 dark:bg-green-900", text: "text-green-700 dark:text-green-300", label: "NORMAL" },
    warning: { bg: "bg-yellow-100 dark:bg-yellow-900", text: "text-yellow-700 dark:text-yellow-300", label: "WARNING" },
    alert: { bg: "bg-red-100 dark:bg-red-900", text: "text-red-700 dark:text-red-300", label: "ALERT" },
  };

  const statusStyle = statusBadges[status];

  return (
    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="bg-green-600 rounded-xl p-3 flex items-center justify-center">
          {icon || <Activity className="size-5 text-white" />}
        </div>
        <div className={`${statusStyle.bg} ${statusStyle.text} px-3 py-1 rounded-full text-xs font-medium`}>
          {statusStyle.label}
        </div>
      </div>

      <div className="text-lg font-semibold text-gray-600 dark:text-gray-300 mb-2">{title}</div>

      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-4xl font-bold text-gray-900 dark:text-gray-100">{value.toFixed(2)}</span>
        <span className="text-base text-gray-600 dark:text-gray-400">{unit}</span>
      </div>

      {timestamp && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="size-2 rounded-full bg-gray-400"></div>
          <span>{timestamp}</span>
        </div>
      )}
    </div>
  );
}