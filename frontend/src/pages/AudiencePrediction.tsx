import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { api } from "../lib/api";
import KPITile from "../components/KPITile";

export default function AudiencePrediction() {
  const [insights, setInsights] = useState<Record<string, unknown> | null>(null);
  const [segments, setSegments] = useState<Array<Record<string, unknown>>>([]);
  const [heatmap, setHeatmap] = useState<Array<Record<string, unknown>>>([]);
  const [weather, setWeather] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    api.executive.matchdayInsights().then(setInsights).catch(() => setInsights(null));
    api.audience.segments().then(setSegments);
    api.audience.heatmap().then(setHeatmap);
    api.weather.current().then(setWeather);
  }, []);

  const nextDemand = (insights?.next_match_demand ?? null) as Record<string, unknown> | null;
  const chartRaw = (insights?.attendance_chart_series ?? []) as Array<Record<string, unknown>>;
  const chartData = chartRaw.map((row) => ({
    opponent: String(row.opponent),
    attendance: Number(row.attendance ?? 0),
    kind: String(row.kind ?? "projected"),
    date: String(row.date ?? ""),
  }));

  const prevHome = ((insights?.previous_fixtures ?? []) as Array<Record<string, unknown>>).filter(
    (p) => p.is_home
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-8"
    >
      <div>
        <h1 className="text-3xl font-display tracking-wider text-white">
          Audience & Matchday Demand
        </h1>
        <p className="text-white/60 mt-1">
          Next match and upcoming demand from the schedule; recent home crowds for context
        </p>
        {weather && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
          >
            <span className="text-white/60">Live weather (Barcelona):</span>
            <span className="font-semibold text-white">{String(weather.temp_c)}°C</span>
            <span className="text-white/60">{String(weather.conditions)}</span>
            {Number(weather.attendance_impact_pct ?? 0) < 0 && (
              <span className="text-amber-600">Impact: {String(weather.attendance_impact_pct)}%</span>
            )}
          </motion.div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPITile
          title="Next match (forecast)"
          value={
            nextDemand?.predicted_attendance != null
              ? Number(nextDemand.predicted_attendance).toLocaleString()
              : "—"
          }
          subtitle={
            nextDemand?.opponent
              ? `${String(nextDemand.opponent)} · ${nextDemand.is_home ? "Home" : "Away"}`
              : "Loading schedule…"
          }
        />
        <KPITile
          title="Stadium occupancy (next)"
          value={
            nextDemand?.predicted_occupancy != null
              ? `${Math.round(Number(nextDemand.predicted_occupancy) * 100)}%`
              : "—"
          }
          subtitle="Model vs capacity / allocation"
        />
        <KPITile
          title="Demand tier"
          value={nextDemand?.demand_tier != null ? String(nextDemand.demand_tier) : "—"}
          subtitle="Booking / pricing pressure"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
          <h2 className="text-lg font-semibold text-white mb-1">Crowds: recent home + projected</h2>
          <p className="text-xs text-white/50 mb-4">
            Actual attendance at Spotify Camp Nou (recent), then projected home gates from upcoming fixtures
          </p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ bottom: 8 }}>
                <XAxis dataKey="opponent" stroke="#94a3b8" fontSize={11} interval={0} angle={-25} textAnchor="end" height={70} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e4e4e7",
                    borderRadius: "8px",
                    color: "#18181b",
                  }}
                  formatter={(value: number) => [value.toLocaleString(), "Attendance"]}
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as { date?: string; kind?: string };
                    return `${p?.date ?? ""} (${p?.kind === "actual" ? "actual" : "projected"})`;
                  }}
                />
                <Legend />
                <Bar dataKey="attendance" radius={[4, 4, 0, 0]} name="Attendance">
                  {chartData.map((e, i) => (
                    <Cell key={i} fill={e.kind === "actual" ? "#27272a" : "#004D98"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
          <h2 className="text-lg font-semibold text-white mb-4">Demand by zone</h2>
          <div className="space-y-3">
            {heatmap.map((z: Record<string, unknown>, i: number) => (
              <div key={i} className="flex items-center gap-4">
                <span className="w-32 text-white/80 text-sm">{String(z.zone)}</span>
                <div className="flex-1 h-6 bg-white/5 rounded overflow-hidden">
                  <div
                    className="h-full bg-fcb-blue rounded transition-all"
                    style={{ width: `${Number(z.demand_score ?? 0)}%` }}
                  />
                </div>
                <span className="w-12 text-right text-white/60 text-sm">
                  {Number(z.occupancy_pct ?? 0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
        <h2 className="text-lg font-semibold text-white mb-1">Recent results (context)</h2>
        <p className="text-sm text-white/50 mb-4">Previous matches used alongside the schedule for demand calibration</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-white/60 border-b border-white/10">
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Opponent</th>
                <th className="pb-2 pr-4">Venue</th>
                <th className="pb-2 pr-4">Score</th>
                <th className="pb-2">Attendance</th>
              </tr>
            </thead>
            <tbody>
              {prevHome.slice(0, 8).map((p, i) => (
                <tr key={i} className="border-t border-surface-100">
                  <td className="py-2 pr-4 text-white/60">{String(p.date)}</td>
                  <td className="py-2 pr-4 font-medium text-white">{String(p.opponent)}</td>
                  <td className="py-2 pr-4 text-white/60">{String(p.venue)}</td>
                  <td className="py-2 pr-4">{String(p.score)}</td>
                  <td className="py-2">
                    {Number(p.attendance ?? 0) > 0 ? Number(p.attendance).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
        <h2 className="text-lg font-semibold text-white mb-4">Fan segmentation</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-white/60 text-sm">
                <th className="pb-3">Segment</th>
                <th className="pb-3">Count</th>
                <th className="pb-3">Avg spend (EUR )</th>
                <th className="pb-3">Attendance rate</th>
              </tr>
            </thead>
            <tbody>
              {segments.map((s: Record<string, unknown>, i: number) => (
                <tr key={i} className="border-t border-white/10">
                  <td className="py-3 font-medium text-white">{String(s.segment)}</td>
                  <td className="py-3 text-white/60">
                    {Number(s.count ?? 0).toLocaleString()}
                  </td>
                  <td className="py-3 text-white/60">EUR {Number(s.avg_spend ?? 0)}</td>
                  <td className="py-3 text-white/60">
                    {Number(s.attendance_rate ?? 0) * 100}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {nextDemand && (
        <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
          <h2 className="text-lg font-semibold text-white mb-4">Next match confidence band</h2>
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium text-white">{String(nextDemand.opponent)}</span>
              <span className="text-sm text-white/60">
                {Number(nextDemand.predicted_attendance ?? 0).toLocaleString()} ±{" "}
                {Math.round(
                  (Number(nextDemand.confidence_high ?? 0) - Number(nextDemand.confidence_low ?? 0)) / 2
                )}
              </span>
            </div>
            <div className="h-2 bg-white/15 rounded-full overflow-hidden">
              <div
                className="h-full bg-fcb-blue rounded-full"
                style={{
                  width: `${
                    ((Number(nextDemand.predicted_attendance ?? 0) - Number(nextDemand.confidence_low ?? 0)) /
                      Math.max(
                        1,
                        Number(nextDemand.confidence_high ?? 1) - Number(nextDemand.confidence_low ?? 0)
                      )) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
