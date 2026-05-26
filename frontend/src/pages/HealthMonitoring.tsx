import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import KPITile from "../components/KPITile";
import { AlertTriangle, CheckCircle, Loader2, Radio } from "lucide-react";
import {
  buildActiveSquadHealth,
  premierLeagueSeasonYear,
  summarizeSquadKpis,
  type HealthDisplayRow,
} from "../lib/liveSquadHealth";

const LA_LIGA = 140;
const FCB_TEAM = 529;
const SEASON = premierLeagueSeasonYear();

export default function HealthMonitoring() {
  const [health, setHealth] = useState<HealthDisplayRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [injuryRiskSample, setInjuryRiskSample] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([
      api.football.barcelona.playerPerformanceLive(SEASON).catch(() => null),
      api.football
        .injuries({ team: FCB_TEAM, league: LA_LIGA, season: SEASON })
        .catch(() => null),
      api.squadValue.squad().catch(() => null),
    ])
      .then(([bundle, injRes, svRes]) => {
        const { rows, ok, error } = buildActiveSquadHealth(
          bundle as Record<string, unknown> | null,
          injRes as Record<string, unknown> | null,
          svRes as Record<string, unknown> | null
        );
        if (!ok) {
          setHealth([]);
          setLoadError(error ?? "Could not load live squad.");
          return;
        }
        setHealth(rows);
      })
      .catch(() => {
        setHealth([]);
        setLoadError("Failed to load live data.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (health.length === 0) {
      setInjuryRiskSample(null);
      return;
    }
    const avgLoad = Math.round(health.reduce((s, h) => s + h.training_load, 0) / health.length);
    const avgFatigue = Math.round(health.reduce((s, h) => s + h.fatigue, 0) / health.length);
    const avgMins = health.reduce((s, h) => s + h.pl_minutes, 0) / health.length;
    api.ml
      .predictInjuryRisk({
        training_load: avgLoad,
        fatigue: avgFatigue,
        matches_7d: Math.min(4, Math.max(0, Math.round(avgMins / 200))),
        minutes_7d: Math.min(450, Math.round(avgMins / 6)),
      })
      .then(setInjuryRiskSample)
      .catch(() => setInjuryRiskSample(null));
  }, [health]);

  const { atRisk, available, benchDepthScore, avgFatigue } = summarizeSquadKpis(health);
  const total = health.length || 1;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display tracking-widest text-white uppercase">
          Health & Squad Readiness
        </h1>
        <p className="text-white/60 mt-1 flex flex-wrap items-center gap-2">
          <Radio className="w-4 h-4 text-fcb-yellow shrink-0" />
          <span>
            Live API-Football only — La Liga minutes + injury list.{" "}
            <strong>Active squad</strong> excludes players currently <strong>loaned out</strong> (when transfer data is
            available).
          </span>
        </p>
        {loading && (
          <p className="text-sm text-white/50 mt-2 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading live squad…
          </p>
        )}
        {loadError && !loading && (
          <p className="text-sm text-amber-300 mt-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
            {loadError} Set <code className="text-xs bg-black/30 px-1 rounded">API_FOOTBALL_KEY</code> on the app if missing.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPITile
          title="Available"
          value={available.length}
          subtitle="Ready for selection (live)"
        />
        <KPITile
          title="At Risk"
          value={atRisk.length}
          subtitle="Injury list or workload"
        />
        <KPITile
          title="Bench Depth Score"
          value={String(Math.min(100, Math.max(0, benchDepthScore)))}
          subtitle="Out of 100"
        />
        <KPITile
          title="Avg Fatigue"
          value={`${health.length ? avgFatigue : 0}%`}
          subtitle="Derived from PL minutes + injuries"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
          <h2 className="text-lg font-semibold text-white mb-4">Player Status</h2>
          {!health.length && !loading ? (
            <p className="text-sm text-white/50">No active players in the live feed.</p>
          ) : (
            <div className="space-y-3">
              {health.map((h) => (
                <div
                  key={h.player_id}
                  className={`p-4 rounded-lg border ${
                    h.status !== "Available"
                      ? "bg-rose-500/10 border-rose-500/30"
                      : h.injury_risk === "Medium"
                        ? "bg-amber-500/10 border-amber-500/30"
                        : "bg-white/5 border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {h.status !== "Available" || h.injury_risk === "Medium" ? (
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                      )}
                      <div>
                        <p className="font-medium text-white">{h.player_name}</p>
                        <p className="text-sm text-white/60">
                          {h.status} • Risk: {h.injury_risk}
                        </p>
                      </div>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-white/60">Fatigue: {h.fatigue}%</p>
                      <p className="text-white/60">Load: {h.training_load}%</p>
                      <p className="text-white/50 text-xs">PL min: {h.pl_minutes}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
          <h2 className="text-lg font-semibold text-white mb-4">Workload vs Fatigue</h2>
          {!health.length && !loading ? (
            <p className="text-sm text-white/50">No rows to chart.</p>
          ) : (
            <div className="space-y-4">
              {health.map((h) => (
                <div key={h.player_id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/80">{h.player_name}</span>
                    <span className="text-white/50">
                      F:{h.fatigue}% L:{h.training_load}%
                    </span>
                  </div>
                  <div className="flex gap-1 h-2">
                    <div className="flex-1 bg-white/10 rounded overflow-hidden" title="Fatigue">
                      <div
                        className="h-full bg-amber-500/70 rounded"
                        style={{ width: `${h.fatigue}%` }}
                      />
                    </div>
                    <div className="flex-1 bg-white/10 rounded overflow-hidden" title="Training Load">
                      <div
                        className="h-full bg-fcb-blue/70 rounded"
                        style={{ width: `${h.training_load}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {injuryRiskSample && health.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass"
        >
          <h2 className="text-lg font-semibold text-white mb-2">ML Injury Risk Model</h2>
          <p className="text-sm text-white/60 mb-4">
            Squad roll-up from live averages (training load {Math.round(health.reduce((s, h) => s + h.training_load, 0) / total)}%, fatigue{" "}
            {avgFatigue}%).
          </p>
          <div className="flex gap-4 flex-wrap">
            <div className="px-4 py-2 rounded-lg bg-white/[0.10] backdrop-blur-xl border border-white/15">
              <span className="text-white/60 text-sm">Risk Score</span>
              <p className="text-xl font-bold text-white">
                {(() => {
                  const v = (injuryRiskSample as { risk_score?: unknown }).risk_score;
                  if (v == null || typeof v === "object") return "-";
                  return String(v);
                })()}
              </p>
            </div>
            <div className="px-4 py-2 rounded-lg bg-white/[0.10] backdrop-blur-xl border border-white/15">
              <span className="text-white/60 text-sm">At Risk</span>
              <p className="text-lg font-semibold">
                {(injuryRiskSample as { at_risk?: boolean }).at_risk ? "Yes" : "No"}
              </p>
            </div>
            <div className="px-4 py-2 rounded-lg bg-white/[0.10] backdrop-blur-xl border border-white/15 min-w-[200px]">
              <span className="text-white/60 text-sm">Recommendation</span>
              <p className="text-sm font-medium">
                {(() => {
                  const v = (injuryRiskSample as { recommendation?: unknown }).recommendation;
                  if (v == null || typeof v === "object") return "-";
                  return String(v);
                })()}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
        <h2 className="text-lg font-semibold text-white mb-4">Medical Risk Flags</h2>
        {!atRisk.length ? (
          <p className="text-sm text-white/50">No players flagged on the live feed.</p>
        ) : (
          <div className="space-y-3">
            {atRisk.map((h) => (
              <div key={h.player_id} className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <p className="font-medium text-white">{h.player_name}</p>
                <p className="text-sm text-white/60 mt-1">
                  {h.status !== "Available"
                    ? `Status: ${h.status}. Consider rotation for cup fixtures.`
                    : `Elevated fatigue (${h.fatigue}%). Monitor training load.`}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
