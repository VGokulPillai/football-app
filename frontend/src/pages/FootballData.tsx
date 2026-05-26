import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Calendar,
  TrendingUp,
  AlertTriangle,
  ArrowRightLeft,
  Target,
  BarChart3,
  Trophy,
} from "lucide-react";
import { api } from "../lib/api";

const MEDIA_BASE = "https://media.api-sports.io/football";
const LA_LIGA = 140;
const FCB_ID = 529;
// Current season: Aug–Jul (e.g. Aug 2025 = 2025 season)
const SEASON = (() => {
  const d = new Date();
  return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
})();

export default function FootballData() {
  const [fixtures, setFixtures] = useState<Record<string, unknown> | null>(null);
  const [squad, setSquad] = useState<Record<string, unknown> | null>(null);
  const [injuries, setInjuries] = useState<Record<string, unknown> | null>(null);
  const [transfers, setTransfers] = useState<Record<string, unknown> | null>(null);
  const [topScorers, setTopScorers] = useState<Record<string, unknown> | null>(null);
  const [topAssists, setTopAssists] = useState<Record<string, unknown> | null>(null);
  const [predictions, setPredictions] = useState<Record<string, unknown> | null>(null);
  const [squadValue, setSquadValue] = useState<Record<string, unknown> | null>(null);
  const [standings, setStandings] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Current season data: squad, fixtures, injuries, transfers, scorers, etc.
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [f, sq, inj, tr, ts, ta, pred, sv, st] = await Promise.allSettled([
          api.football.barcelona.fixtures(15),
          api.football.barcelona.squad(SEASON),
          api.football.injuries({ team: FCB_ID, league: LA_LIGA, season: SEASON }),
          api.football.transfers({ team: FCB_ID }),
          api.football.topScorers(LA_LIGA, SEASON),
          api.football.topAssists(LA_LIGA, SEASON),
          api.football.predictions({ league: LA_LIGA, season: SEASON }),
          api.squadValue.squad(),
          api.football.barcelona.standings(SEASON),
        ]);
        setFixtures(f.status === "fulfilled" ? f.value : null);
        setSquad(sq.status === "fulfilled" ? sq.value : null);
        setInjuries(inj.status === "fulfilled" ? inj.value : null);
        setTransfers(tr.status === "fulfilled" ? tr.value : null);
        setTopScorers(ts.status === "fulfilled" ? ts.value : null);
        setTopAssists(ta.status === "fulfilled" ? ta.value : null);
        setPredictions(pred.status === "fulfilled" ? pred.value : null);
        setSquadValue(sv.status === "fulfilled" ? sv.value : null);
        setStandings(st.status === "fulfilled" ? st.value : null);
        if ([f, sq].every((x) => x.status === "rejected")) {
          setError("API-Football unavailable. Check API_FOOTBALL_KEY.");
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const fixturesList = (fixtures as any)?.response ?? [];
  const squadData = (squad as any)?.response?.[0];
  const rawPlayers = squadData?.players ?? [];
  const svSquad = (squadValue as any)?.squad ?? [];
  const loanMap = Object.fromEntries(
    svSquad.filter((p: any) => p.loan_status).map((p: any) => [String(p.api_football_id ?? p.id ?? p.name), p.loan_status])
  );
  const squadPlayers = rawPlayers.map((p: any) => ({
    ...p,
    loan_status: loanMap[String(p.id)] ?? loanMap[p.name],
  }));
  const loanedOut = (squadValue as any)?.loaned_out ?? [];
  const injuriesList = (injuries as any)?.response ?? [];
  const transfersList = (transfers as any)?.response ?? [];
  const scorersList = (topScorers as any)?.response ?? [];
  const assistsList = (topAssists as any)?.response ?? [];
  const predictionsList = (predictions as any)?.response ?? [];
  const standingsResp = (standings as any)?.response ?? [];
  const leagueData = standingsResp[0];
  const standingsGroups = leagueData?.league?.standings ?? [];
  const standingsRows = (standingsGroups[0] ?? []) as Array<{
    rank?: number;
    team?: { id?: number; name?: string; logo?: string };
    points?: number;
    goalsDiff?: number;
    all?: { played?: number };
  }>;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin w-12 h-12 border-4 border-fcb-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      <div>
        <h1 className="text-3xl font-display tracking-widest text-white uppercase">
          Live Football Data
        </h1>
        <p className="text-white/60 mt-1">
          Real-time data from API-Football — standings, fixtures, squad, injuries, transfers
        </p>
        {error && (
          <div className="mt-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* La Liga Standings */}
        <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5" />
            La Liga Standings
          </h2>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-white/60 border-b border-white/10">
                  <th className="pb-2 pr-2">#</th>
                  <th className="pb-2">Team</th>
                  <th className="pb-2 text-center">P</th>
                  <th className="pb-2 text-center">GD</th>
                  <th className="pb-2 text-right">Pts</th>
                </tr>
              </thead>
              <tbody>
                {standingsRows.map((r, i) => (
                  <tr key={i} className="border-b border-surface-100 hover:bg-white/5">
                    <td className="py-2 pr-2 font-medium text-white">{r.rank ?? i + 1}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <img
                          src={`${MEDIA_BASE}/teams/${r.team?.id}.png`}
                          alt=""
                          className="w-6 h-6 object-contain shrink-0"
                          onError={(e) => (e.currentTarget.style.display = "none")}
                        />
                        <span className="font-medium text-white">{r.team?.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="py-2 text-center text-white/60">{r.all?.played ?? 0}</td>
                    <td className="py-2 text-center text-white/60">{r.goalsDiff ?? 0}</td>
                    <td className="py-2 text-right font-bold text-white">{r.points ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {standingsRows.length === 0 && (
              <p className="py-4 text-white/50 text-sm">No standings data available</p>
            )}
          </div>
        </div>

        {/* Upcoming Fixtures */}
        <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5" />
            Upcoming Fixtures
          </h2>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {fixturesList.slice(0, 8).map((f: any, i: number) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <img
                    src={`${MEDIA_BASE}/teams/${f.teams?.home?.id}.png`}
                    alt=""
                    className="w-8 h-8 object-contain shrink-0"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                  <span className="text-sm font-medium truncate">{f.teams?.home?.name}</span>
                </div>
                <span className="text-white/50 text-sm px-2">vs</span>
                <div className="flex items-center gap-2 flex-1 min-w-0 justify-end">
                  <span className="text-sm font-medium truncate">{f.teams?.away?.name}</span>
                  <img
                    src={`${MEDIA_BASE}/teams/${f.teams?.away?.id}.png`}
                    alt=""
                    className="w-8 h-8 object-contain shrink-0"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                </div>
                <span className="text-xs text-white/50 ml-2 shrink-0">
                  {new Date(f.fixture?.date).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Squad with Player Photos - Current Season */}
      <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
          <Users className="w-5 h-5" />
          FC Barcelona Squad <span className="text-sm font-normal text-white/50">({SEASON}-{(SEASON + 1) % 100})</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {squadPlayers.map((p: any, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex flex-col items-center p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors relative"
            >
              {p.loan_status === "loan_in" && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500 text-white rounded">LOAN IN</span>
              )}
              <img
                src={`${MEDIA_BASE}/players/${p.id}.png`}
                alt={p.name}
                className="w-20 h-20 rounded-full object-cover border-2 border-white/20"
                onError={(e) => {
                  e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name || "?")}&background=DA291C&color=fff`;
                }}
              />
              <p className="mt-2 font-medium text-white text-sm text-center truncate w-full">
                {p.name}
              </p>
              <p className="text-xs text-white/50">{p.position ?? "-"}</p>
              {p.number && (
                <span className="mt-1 text-xs font-bold text-white">#{p.number}</span>
              )}
            </motion.div>
          ))}
        </div>
        {(loanedOut.length > 0 || squadPlayers.some((p: any) => p.loan_status === "loan_in")) && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
            {squadPlayers.filter((p: any) => p.loan_status === "loan_in").length > 0 && (
              <div>
                <p className="text-sm font-semibold text-white/80 mb-2">Loaned In</p>
                <div className="flex flex-wrap gap-2">
                  {squadPlayers.filter((p: any) => p.loan_status === "loan_in").map((p: any, i: number) => (
                    <span key={i} className="px-2 py-1 text-xs font-medium bg-emerald-500/20 text-emerald-300 rounded">
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {loanedOut.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-white/80 mb-2">Out on Loan</p>
                <div className="flex flex-wrap gap-2">
                  {loanedOut.map((p: any, i: number) => (
                    <span key={i} className="px-2 py-1 text-xs font-medium bg-amber-500/20 text-amber-300 rounded">
                      {p.name} → {p.club}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Injuries */}
        <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5" />
            Injuries
          </h2>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {injuriesList.length === 0 ? (
              <p className="text-white/50 text-sm">No injury data available</p>
            ) : (
              injuriesList.slice(0, 10).map((inj: any, i: number) => (
                <div key={i} className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                  <p className="font-medium text-white">{inj.player?.name}</p>
                  <p className="text-sm text-amber-300/80">{inj.player?.reason}</p>
                  <p className="text-xs text-white/50 mt-1">
                    {inj.player?.type}
                    {inj.fixture?.id ? ` • Missing fixture #${inj.fixture.id}` : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Scorers */}
        <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5" />
            La Liga Top Scorers
          </h2>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {scorersList.slice(0, 10).map((s: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-3 p-2 rounded-lg bg-white/5"
              >
                <span className="w-6 text-center font-bold text-white">{i + 1}</span>
                <img
                  src={`${MEDIA_BASE}/players/${s.player?.id}.png`}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{s.player?.name}</p>
                  <p className="text-xs text-white/50">{s.statistics?.[0]?.team?.name}</p>
                </div>
                <span className="font-bold text-white">{s.statistics?.[0]?.goals?.total ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transfers */}
        <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <ArrowRightLeft className="w-5 h-5" />
            Recent Transfers
          </h2>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {transfersList.length === 0 ? (
              <p className="text-white/50 text-sm">No transfer data</p>
            ) : (
              transfersList.slice(0, 8).map((t: any, i: number) => (
                <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="font-medium text-white">{t.player?.name}</p>
                  <p className="text-sm text-white/60">
                    {t.teams?.in?.name} → {t.teams?.out?.name}
                  </p>
                  <p className="text-xs text-white/50">{t.update}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Assists */}
        <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Target className="w-5 h-5" />
            Top Assists
          </h2>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {assistsList.slice(0, 10).map((a: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-white/5">
                <span className="w-6 text-center font-bold text-white">{i + 1}</span>
                <img
                  src={`${MEDIA_BASE}/players/${a.player?.id}.png`}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{a.player?.name}</p>
                  <p className="text-xs text-white/50">{a.statistics?.[0]?.team?.name}</p>
                </div>
                <span className="font-bold text-white">{a.statistics?.[0]?.goals?.assists ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {predictionsList.length > 0 && (
        <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5" />
            Match Predictions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {predictionsList.slice(0, 6).map((p: any, i: number) => (
              <div key={i} className="p-4 rounded-lg bg-white/5 border border-white/10">
                <p className="font-medium text-white">
                  {p.teams?.home?.name} vs {p.teams?.away?.name}
                </p>
                <p className="text-sm text-white/60 mt-1">
                  Winner: {p.predictions?.winner?.name ?? "-"}
                </p>
                <p className="text-xs text-white/50">
                  Confidence: {p.predictions?.winner?.comment ?? "-"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
