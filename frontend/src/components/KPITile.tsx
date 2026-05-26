import { ReactNode } from "react";

interface KPITileProps {
  title: string;
  value: string | number;
  subtitle?: string;
  valueHint?: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
}

export default function KPITile({ title, value, subtitle, valueHint, icon, trend }: KPITileProps) {
  return (
    <div className="glass-card-light h-full w-full min-h-[7.5rem] p-4 sm:p-5 flex flex-col">
      <div className="flex items-start justify-between gap-2 flex-1 min-h-0">
        <div className="min-w-0 flex-1 flex flex-col">
          <p
            className="text-sm text-white/60 font-medium uppercase tracking-wide leading-snug line-clamp-2 min-h-[2.5rem]"
            title={title}
          >
            {title}
          </p>
          <p
            className={`text-2xl font-bold text-white mt-1 leading-none tabular-nums shrink-0 ${valueHint ? "cursor-help underline decoration-dotted decoration-white/30 underline-offset-4" : ""}`}
            title={valueHint || undefined}
          >
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-white/50 mt-1 line-clamp-2 leading-snug min-h-[2.25rem]" title={subtitle}>
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className="p-2 rounded-lg bg-white/10 text-fcb-yellow shrink-0">{icon}</div>
        )}
      </div>
      {trend && (
        <div
          className={`mt-2 text-xs font-medium ${
            trend === "up"
              ? "text-emerald-400"
              : trend === "down"
              ? "text-rose-400"
              : "text-white/50"
          }`}
        >
          {trend === "up" && "↑"}
          {trend === "down" && "↓"}
          {trend === "neutral" && "→"}
        </div>
      )}
    </div>
  );
}
