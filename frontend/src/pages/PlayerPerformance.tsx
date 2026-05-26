import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  CartesianGrid,
} from "recharts";
import { Activity, Shield, Swords, AlertCircle, RefreshCw } from "lucide-react";
import { api } from "../lib/api";

const LA_LIGA = 140;
const SEASON = (() => {
  const d = new Date();
  return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
})();

type LivePlayer = {
  player_id: number;
  name: string;
  photo?: string;
  position?: string;
  appearances: number;
  minutes: number;
  rating?: string | number | null;
  goals: number;
  assists: number;
  shots: number;
  shots_on_target: number;
  passes_key: number;
  pass_accuracy: number;
  tackles: number;
  interceptions: number;
  duels_won: number;
  dribbles_success: number;
  attacking_index: number;
  defensive_index: number;
  attacking_contribution_raw: number;
  defensive_contribution_raw: number;
};

type CompareMetric =
  | "minutes"
  | "goals"
  | "assists"
  | "attacking_index"
  | "defensive_index"
  | "tackles"
  | "interceptions"
  | "shots_on_target"
  | "pass_accuracy";

const METRIC_LABELS: Record<CompareMetric, string> = {
  minutes: "Minutes",
  goals: "Goals",
  assists: "Assists",
  attacking_index: "Attacking index (squad-norm.)",
  defensive_index: "Defensive index (squad-norm.)",
  tackles: "Tackles",
  interceptions: "Interceptions",
  shots_on_target: "Shots on target",
  pass_accuracy: "Pass accuracy %",
};

function shortName(n: string) {
  const parts = n.split(" ");
  if (parts.length === 1) return parts[0].slice(0, 10);
  return `${parts[0][0]}. ${parts[parts.length - 1]}`.slice(0, 14);
}

function num(p: LivePlayer, key: CompareMetric): number {
  const v = p[key];
  return typeof v === "number" ? v : 0;
}

export default function PlayerPerformance() {
  const [bundle, setBundle] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [compareMetric, setCompareMetric] = useState<CompareMetric>("attacking_index");

  const load = () => {
    setLoading(true);
    setErr(null);
    api.football.barcelona
      .playerPerformanceLive(SEASON)
      .then((data) => {
        setBundle(data);
        if (data.ok === false && typeof data.error === "string") {
          setErr(data.error);
        }
      })
      .catch((e) => setErr(e instanceof Error ? e.message : "Failed to load live data"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const players = useMemo(() => {
    const raw = bundle?.players;
    if (!Array.isArray(raw)) return [] as LivePlayer[];
    return raw as LivePlayer[];
  }, [bundle]);

  const formation = bundle?.formation != null ? String(bundle.formation) : null;
  const balance = bundle?.formation_balance as
    | {
        attacking_pct?: number;
        defending_pct?: number;
        interpretation?: string;
        method?: string;
      }
    | undefined;

  const fxCtx = bundle?.formation_context as
    | {
        date?: string;
        home_team?: string;
        away_team?: string;
        status?: string;
      }
    | undefined;

  const barData = useMemo(
    () =>
      players.map((p) => ({
        name: shortName(p.name),
        full: p.name,
        v: num(p, compareMetric),
      })),
    [players, compareMetric]
  );

  const top3 = useMemo(() => {
    const sorted = [...players].sort((a, b) => b.minutes - a.minutes);
    return sorted.slice(0, 3);
  }, [players]);

  const radarRows = useMemo(() => {
    if (top3.length === 0) return [];
    return [
      {
        metric: "Attack idx",
        a: top3[0]?.attacking_index ?? 0,
        b: top3[1]?.attacking_index ?? 0,
        c: top3[2]?.attacking_index ?? 0,
      },
      {
        metric: "Defence idx",
        a: top3[0]?.defensive_index ?? 0,
        b: top3[1]?.defensive_index ?? 0,
        c: top3[2]?.defensive_index ?? 0,
      },
      {
        metric: "Goals×20",
        a: Math.min(100, (top3[0]?.goals ?? 0) * 20),
        b: Math.min(100, (top3[1]?.goals ?? 0) * 20),
        c: Math.min(100, (top3[2]?.goals ?? 0) * 20),
      },
      {
        metric: "SoT×10",
        a: Math.min(100, (top3[0]?.shots_on_target ?? 0) * 10),
        b: Math.min(100, (top3[1]?.shots_on_target ?? 0) * 10),
        c: Math.min(100, (top3[2]?.shots_on_target ?? 0) * 10),
      },
      {
        metric: "Tkl×5",
        a: Math.min(100, (top3[0]?.tackles ?? 0) * 5),
        b: Math.min(100, (top3[1]?.tackles ?? 0) * 5),
        c: Math.min(100, (top3[2]?.tackles ?? 0) * 5),
      },
    ];
  }, [top3]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display tracking-widest text-white uppercase">
            Player Performance
          </h1>
          <p className="text-white/60 mt-1 max-w-2xl">
            <strong>Live API-Football only</strong> — La Liga season {SEASON} (league {LA_LIGA}). Squad
            stats and formation balance update from the same source as Live Football Data.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-fcb-blue/40 text-white text-sm font-semibold hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh live
        </button>
      </div>

      {err && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <p className="font-semibold">Could not load live performance bundle</p>
            <p className="text-rose-300/80 mt-1">{err}</p>
          </div>
        </div>
      )}

      {loading && !bundle ? (
        <p className="text-white/50 text-sm">Loading live La Liga statistics…</p>
      ) : null}

      {/* Formation balance — from last match with published lineups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-2 glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass"
        >
          <div className="flex items-center gap-2 mb-2">
            <Swords className="w-5 h-5 text-white" />
            <h2 className="text-lg font-semibold text-white">Formation shape (live)</h2>
          </div>
          <p className="text-xs text-white/50 mb-4">
            {balance?.method ?? "Derived from the most recent fixture where API-Football published a lineup."}
          </p>
          <div className="flex flex-wrap items-baseline gap-3 mb-4">
            <span className="text-3xl font-bold text-white font-display tracking-wide">
              {formation ?? "—"}
            </span>
            {fxCtx?.home_team && fxCtx?.away_team ? (
              <span className="text-sm text-white/60">
                {fxCtx.home_team} vs {fxCtx.away_team}
                {fxCtx.date ? ` · ${fxCtx.date}` : ""}
                {fxCtx.status ? ` · ${fxCtx.status}` : ""}
              </span>
            ) : (
              <span className="text-sm text-white/50">No recent lineup snapshot — bars show neutral split.</span>
            )}
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-medium text-white/60 mb-1">
                <span className="inline-flex items-center gap-1">
                  <Swords className="w-3.5 h-3.5 text-emerald-400" /> Attacking emphasis
                </span>
                <span>{balance?.attacking_pct ?? 50}%</span>
              </div>
              <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${balance?.attacking_pct ?? 50}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs font-medium text-white/60 mb-1">
                <span className="inline-flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-blue-700" /> Defensive emphasis
                </span>
                <span>{balance?.defending_pct ?? 50}%</span>
              </div>
              <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-800 to-blue-600 rounded-full transition-all duration-500"
                  style={{ width: `${balance?.defending_pct ?? 50}%` }}
                />
              </div>
            </div>
          </div>
          <p className="text-sm text-white/80 mt-4 leading-relaxed">{balance?.interpretation}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass flex flex-col justify-center"
        >
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-white" />
            <h2 className="text-lg font-semibold text-white">Squad snapshot</h2>
          </div>
          <p className="text-3xl font-bold text-white">{players.length}</p>
          <p className="text-sm text-white/60">Players with published PL stats in this bundle</p>
          <p className="text-xs text-white/50 mt-4">
            Per-player <strong>attacking / defensive index</strong> is min–max normalized within this squad so you can
            compare roles at a glance.
          </p>
        </motion.div>
      </div>

      {/* Compare all squad members */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-white">Compare entire squad</h2>
            <select
              value={compareMetric}
              onChange={(e) => setCompareMetric(e.target.value as CompareMetric)}
              className="text-sm bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 max-w-[220px]"
            >
              {(Object.keys(METRIC_LABELS) as CompareMetric[]).map((k) => (
                <option key={k} value={k}>
                  {METRIC_LABELS[k]}
                </option>
              ))}
            </select>
          </div>
          <div className="h-[min(420px,55vh)] w-full">
            {barData.length === 0 ? (
              <p className="text-white/50 text-sm">No player rows returned from the live feed.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 8, right: 8, left: 4, bottom: 64 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} interval={0} angle={-45} textAnchor="end" height={60} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    formatter={(value: number) => [value, METRIC_LABELS[compareMetric]]}
                    labelFormatter={(_, payload) => (payload?.[0]?.payload as { full?: string })?.full ?? ""}
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e4e4e7",
                      color: "#18181b",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="v" fill="#004D98" radius={[4, 4, 0, 0]} name={METRIC_LABELS[compareMetric]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
          <h2 className="text-lg font-semibold text-white mb-1">Top 3 by minutes (live radar)</h2>
          <p className="text-xs text-white/50 mb-4">
            {top3.map((p) => p.name).join(" · ") || "—"} — scaled axes for side-by-side shape
          </p>
          <div className="h-80">
            {radarRows.length === 0 ? (
              <p className="text-white/50 text-sm">Not enough players for radar.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarRows}>
                  <PolarGrid stroke="#cbd5e1" />
                  <PolarAngleAxis dataKey="metric" stroke="#64748b" fontSize={10} />
                  <PolarRadiusAxis stroke="#94a3b8" fontSize={9} domain={[0, 100]} />
                  <Radar
                    name={top3[0]?.name ?? "P1"}
                    dataKey="a"
                    stroke="#EDBB00"
                    fill="#004D98"
                    fillOpacity={0.32}
                  />
                  {top3[1] ? (
                    <Radar
                      name={top3[1].name}
                      dataKey="b"
                      stroke="#ca8a04"
                      fill="#ca8a04"
                      fillOpacity={0.22}
                    />
                  ) : null}
                  {top3[2] ? (
                    <Radar
                      name={top3[2].name}
                      dataKey="c"
                      stroke="#2563eb"
                      fill="#2563eb"
                      fillOpacity={0.18}
                    />
                  ) : null}
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
        <h2 className="text-lg font-semibold text-white mb-4">
          Full squad — La Liga (live){players.length ? ` (${players.length})` : ""}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[920px]">
            <thead>
              <tr className="text-left text-white/60 border-b border-white/10">
                <th className="pb-3 pr-2">Player</th>
                <th className="pb-3">Pos</th>
                <th className="pb-3 text-right">Apps</th>
                <th className="pb-3 text-right">Min</th>
                <th className="pb-3 text-right">Atk idx</th>
                <th className="pb-3 text-right">Def idx</th>
                <th className="pb-3 text-right">G</th>
                <th className="pb-3 text-right">A</th>
                <th className="pb-3 text-right">SoT</th>
                <th className="pb-3 text-right">Pass%</th>
                <th className="pb-3 text-right">Tkl</th>
                <th className="pb-3 text-right">Int</th>
                <th className="pb-3 text-right">Duels W</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p, i) => (
                <tr key={`${p.player_id}-${i}`} className="border-t border-surface-100 hover:bg-white/5">
                  <td className="py-2.5 pr-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <img
                        src={
                          p.photo ??
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=DA291C&color=fff&size=64`
                        }
                        alt=""
                        className="w-8 h-8 rounded-full object-cover shrink-0"
                        onError={(e) => {
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=DA291C&color=fff&size=64`;
                        }}
                      />
                      <span className="font-medium text-white truncate">{p.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-white/60 whitespace-nowrap">{p.position || "—"}</td>
                  <td className="py-2.5 text-right tabular-nums">{p.appearances}</td>
                  <td className="py-2.5 text-right tabular-nums">{p.minutes}</td>
                  <td className="py-2.5 text-right tabular-nums text-emerald-700 font-medium">{p.attacking_index}</td>
                  <td className="py-2.5 text-right tabular-nums text-blue-800 font-medium">{p.defensive_index}</td>
                  <td className="py-2.5 text-right tabular-nums">{p.goals}</td>
                  <td className="py-2.5 text-right tabular-nums">{p.assists}</td>
                  <td className="py-2.5 text-right tabular-nums">{p.shots_on_target}</td>
                  <td className="py-2.5 text-right tabular-nums">{p.pass_accuracy}%</td>
                  <td className="py-2.5 text-right tabular-nums">{p.tackles}</td>
                  <td className="py-2.5 text-right tabular-nums">{p.interceptions}</td>
                  <td className="py-2.5 text-right tabular-nums">{p.duels_won}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
