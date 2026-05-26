import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, ArrowRightLeft } from "lucide-react";

export default function TransferIntelligence() {
  const [targets, setTargets] = useState<Array<Record<string, unknown>>>([]);
  const [squadValue, setSquadValue] = useState<Record<string, unknown> | null>(null);
  const [transferPotential, setTransferPotential] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    api.transfers.targets().then(setTargets);
  }, []);

  useEffect(() => {
    api.squadValue.squad().then(setSquadValue).catch(() => {});
    api.squadValue.transferPotential().then(setTransferPotential).catch(() => {});
  }, []);

  const squad = (squadValue as any)?.squad ?? [];
  const totalValue = (squadValue as any)?.total_value_m ?? 0;
  const potentialData = (transferPotential as any)?.targets ?? targets;
  const recentTransfers = (transferPotential as any)?.recent_transfers ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display tracking-widest text-white uppercase">
          Transfer Intelligence
        </h1>
        <p className="text-white/60 mt-1">
          Squad value, transfer potential, ML fit scores, and API-Football data
        </p>
      </div>

      {/* Squad Value */}
      {squadValue && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass"
        >
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Users className="w-5 h-5" />
            Squad Value & Potential
          </h2>
          <div className="flex items-center gap-6 mb-4">
            <div className="px-5 py-3 rounded-lg bg-white/[0.08] backdrop-blur-xl border border-white/20">
              <span className="text-white/60 text-sm">Total Squad Value</span>
              <p className="text-2xl font-bold text-white">EUR {totalValue}M</p>
            </div>
            <div className="text-sm text-white/60">
              ML-estimated from age, position, and potential
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 max-h-48 overflow-y-auto">
            {squad.slice(0, 12).map((p: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-white/10 border border-white/10 flex flex-col items-center relative">
                {p.loan_status === "loan_in" && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500 text-white rounded">LOAN IN</span>
                )}
                <img
                  src={p.photo_url ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=DA291C&color=fff`}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
                <p className="text-xs font-medium truncate w-full text-center mt-1">{p.name}</p>
                <p className="text-white font-bold text-sm">EUR {p.estimated_value_m}M</p>
                {p.potential_value_m > p.estimated_value_m && (
                  <p className="text-emerald-400 text-xs">Pot. EUR {p.potential_value_m}M</p>
                )}
              </div>
            ))}
          </div>
          {(squadValue as any)?.loaned_out?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-sm font-semibold text-white/80 mb-2">Out on Loan</p>
              <div className="flex flex-wrap gap-2">
                {(squadValue as any).loaned_out.map((p: any, i: number) => (
                  <span key={i} className="px-2 py-1 text-xs font-medium bg-amber-500/20 text-amber-300 rounded">LOAN OUT: {p.name} → {p.club}</span>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
          <h2 className="text-lg font-semibold text-white mb-4">Target Scores</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={potentialData.length ? potentialData : targets} layout="vertical" margin={{ left: 80 }}>
                <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" fontSize={12} />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="#94a3b8"
                  fontSize={11}
                  width={70}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    border: "1px solid #e4e4e7",
                    borderRadius: "8px",
                    color: "#18181b",
                  }}
                />
                <Bar dataKey="sporting_fit" fill="#004D98" name="Sporting" radius={[0, 4, 4, 0]} />
                <Bar dataKey="commercial_value" fill="#003880" name="Commercial" radius={[0, 4, 4, 0]} />
                <Bar dataKey="tactical_fit" fill="#10b981" name="Tactical" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5" />
            Transfer Potential (ML Fit)
          </h2>
          <div className="space-y-4">
            {(potentialData.length ? potentialData : targets).map((t: any, i: number) => (
              <div
                key={i}
                className="p-4 rounded-lg bg-white/5 border border-white/10"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-white">{String(t.name)}</p>
                    <p className="text-sm text-white/60">
                      {String(t.position)} • {String(t.club)} • {String(t.age)} yrs
                    </p>
                  </div>
                  <span
                    className="text-transfer-market-value font-semibold tabular-nums shrink-0"
                    style={{ color: "#004D98" }}
                  >
                    €{String(t.estimated_value_m ?? 0)}M
                  </span>
                </div>
                <p className="text-sm text-fcb-yellow mt-2">{String(t.recommendation)}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {t.ml_fit_score != null && (
                    <span className="text-xs px-2 py-0.5 rounded bg-white/15 text-fcb-yellow font-medium">
                      ML Fit: {t.ml_fit_score}
                    </span>
                  )}
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      t.risk_level === "Low"
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-white/15 text-fcb-yellow border border-white/15"
                    }`}
                  >
                    {String(t.risk_level ?? "Medium")} risk
                  </span>
                  <span className="text-xs text-white/50">
                    Popularity: {String(t.popularity ?? "-")} | Tactical: {String(t.tactical_fit ?? "-")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(recentTransfers.length > 0 || true) && (
        <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <ArrowRightLeft className="w-5 h-5" />
            Recent Transfers (API-Football)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recentTransfers.length > 0 ? recentTransfers.slice(0, 6).map((t: any, i: number) => (
              <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="font-medium text-white">{t.player}</p>
                <p className="text-sm text-white/60">{t.from} → {t.to}</p>
                <p className="text-xs text-white/50">{t.date}</p>
              </div>
            )) : (
              <p className="text-white/50 text-sm col-span-2">No recent transfer data from API.</p>
            )}
          </div>
        </div>
      )}

      <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
        <h2 className="text-lg font-semibold text-white mb-4">Squad Gap Analysis</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <p className="text-sm text-white/60">Left Back</p>
            <p className="font-medium text-amber-400">Priority Gap</p>
            <p className="text-xs text-white/50 mt-1">Theo Hernández recommended</p>
          </div>
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <p className="text-sm text-white/60">Defensive Mid</p>
            <p className="font-medium text-emerald-400">Covered</p>
          </div>
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <p className="text-sm text-white/60">Striker</p>
            <p className="font-medium text-white/60">Rotation option</p>
          </div>
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <p className="text-sm text-white/60">Attacking Mid</p>
            <p className="font-medium text-white/60">Depth candidate</p>
          </div>
        </div>
      </div>
    </div>
  );
}
