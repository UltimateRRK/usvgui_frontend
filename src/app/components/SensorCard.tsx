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

  const cardStyles = {
    normal: {
      card: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
      icon: "bg-green-600",
    },
    warning: {
      card: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
      icon: "bg-yellow-600",
    },
    alert: {
      card: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
      icon: "bg-red-600",
    },
  };

  const statusStyle = statusBadges[status];
  const cardStyle = cardStyles[status];

  return (
    <div className={`${cardStyle.card} border rounded-xl p-6 h-full transition-colors duration-300`}>
      <div className="flex items-center gap-3 mb-5">
        <div className={`${cardStyle.icon} rounded-xl p-3 flex items-center justify-center transition-colors duration-300`}>
          {icon || <Activity className="size-5 text-white" />}
        </div>
        <div className={`${statusStyle.bg} ${statusStyle.text} px-3 py-1 rounded-full text-sm font-medium`}>
          {statusStyle.label}
        </div>
      </div>

      <div className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-3">{title}</div>

      <div className="flex items-baseline gap-2 mb-4 overflow-hidden">
        <span className="text-[2.5rem] font-bold leading-tight text-gray-900 dark:text-gray-100 truncate">{value.toFixed(2)}</span>
        <span className="text-lg text-gray-600 dark:text-gray-400 shrink-0">{unit}</span>
      </div>

      {timestamp && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="size-2 rounded-full bg-gray-400"></div>
          <span>{timestamp}</span>
        </div>
      )}
    </div>
  );
}