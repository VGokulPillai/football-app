import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users,
  Ticket,
  TrendingUp,
  AlertTriangle,
  Heart,
  Star,
  ArrowRight,
  Bot,
  Sliders,
  Cloud,
  Brain,
} from "lucide-react";
import { api } from "../lib/api";
import KPITile from "../components/KPITile";
import MatchPreviewHero from "../components/MatchPreviewHero";
import { useGenie } from "../contexts/GenieContext";
import { useNotifications } from "../contexts/NotificationContext";
import crestImg from "../assets/fcb-crest.png";
import { buildActiveSquadHealth, laLigaSeasonYear, summarizeSquadKpis } from "../lib/liveSquadHealth";

const LA_LIGA = 140;
const FCB_TEAM = 529;
const LL_SEASON = laLigaSeasonYear();

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

const stagger = {
  animate: {
    transition: { staggerChildren: 0.08 },
  },
};

const FALLBACK_SUMMARY: Record<string, unknown> = {
  squad_readiness: 94,
  available_players: 13,
  injury_risk_count: 1,
  next_match_attendance: 85000,
  next_match_opponent: "Real Madrid",
  projected_ticket_revenue_m: 7.8,
  top_transfer_opportunity: "Nico Williams",
  most_marketable_player: "Lamine Yamal",
  campaign_recommendation: "Feature Yamal's record-breaking La Liga season in campaign creative",
  overall_sentiment: "Positive",
};

const FALLBACK_ALERTS = [
  { title: "Press conference: Real Madrid (H)", message: "Hansi Flick answers questions on El Clásico preparation and squad fitness" },
  { title: "Ter Stegen return confirmed", message: "Goalkeeper cleared for selection after long-term injury recovery" },
  { title: "Yamal record-breaking season", message: "Youngest player to score in El Clásico — global media coverage surging" },
];

const FALLBACK_FIXTURES = [
  { opponent: "Real Madrid", competition: "La Liga", venue: "Spotify Camp Nou", date: "2026-05-03", kickoff: "21:00", is_home: true },
  { opponent: "Atletico Madrid", competition: "La Liga", venue: "Metropolitano", date: "2026-04-19", kickoff: "20:00", is_home: false },
  { opponent: "Sevilla", competition: "La Liga", venue: "Spotify Camp Nou", date: "2026-04-26", kickoff: "18:30", is_home: true },
  { opponent: "Villarreal", competition: "La Liga", venue: "Estadi de la Ceràmica", date: "2026-05-09", kickoff: "20:00", is_home: false },
  { opponent: "Valencia", competition: "La Liga", venue: "Spotify Camp Nou", date: "2026-05-17", kickoff: "18:30", is_home: true },
];

function nextUpcomingFixtures(list: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = list.filter((f) => (String(f.date ?? "") >= today));
  upcoming.sort((a, b) => {
    const da = String(a.date ?? "");
    const db = String(b.date ?? "");
    if (da !== db) return da.localeCompare(db);
    return String(a.kickoff ?? "").localeCompare(String(b.kickoff ?? ""));
  });
  return upcoming.length > 0 ? upcoming : list;
}

export default function ExecutiveDashboard() {
  const { openGenie } = useGenie();
  const { notify } = useNotifications();
  const [summary, setSummary] = useState<Record<string, unknown>>(FALLBACK_SUMMARY);
  const [alerts, setAlerts] = useState<Array<Record<string, unknown>>>(FALLBACK_ALERTS);
  const [fixtures, setFixtures] = useState<Array<Record<string, unknown>>>(FALLBACK_FIXTURES);
  const [weather, setWeather] = useState<Record<string, unknown> | null>(null);
  const [mlAttendance, setMlAttendance] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const fetchData = () => {
      Promise.all([
        api.executive.summary().catch(() => FALLBACK_SUMMARY),
        api.executive.alerts().catch(() => FALLBACK_ALERTS),
        api.executive.fixtures().catch(() => FALLBACK_FIXTURES),
        api.weather.current().catch(() => null),
        api.ml.predictAttendance({ opponent_tier: 1, is_weekend: true, temp_c: 18, competition: "La Liga" }).catch(() => null),
        api.football.barcelona.playerPerformanceLive(LL_SEASON).catch(() => null),
        api.football
          .injuries({ team: FCB_TEAM, league: LA_LIGA, season: LL_SEASON })
          .catch(() => null),
        api.squadValue.squad().catch(() => null),
      ]).then(([s, a, f, w, ml, bundle, injRes, svRes]) => {
      const base = { ...(s as Record<string, unknown>) };
      const live = buildActiveSquadHealth(
        bundle as Record<string, unknown> | null,
        injRes as Record<string, unknown> | null,
        svRes as Record<string, unknown> | null
      );
      if (live.ok && live.rows.length > 0) {
        const k = summarizeSquadKpis(live.rows);
        base.squad_readiness = k.readinessPct;
        base.available_players = k.available.length;
        base.injury_risk_count = k.flaggedCount;
      }
      setSummary(base);
      const alertList = (a as Array<Record<string, unknown>>) || FALLBACK_ALERTS;
      setAlerts(alertList);
      const rawFixtures = (f as Array<Record<string, unknown>>) || FALLBACK_FIXTURES;
      setFixtures(nextUpcomingFixtures(rawFixtures));
      setWeather(w as Record<string, unknown> | null);
      setMlAttendance(ml as Record<string, unknown> | null);
      if (alertList.length > 0) {
        const first = alertList[0];
        notify({ type: "info", title: String(first.title ?? "Alert"), message: String(first.message ?? ""), duration: 6000 });
      }
      });
    };
    fetchData();
    const interval = setInterval(fetchData, 120_000);
    return () => clearInterval(interval);
  }, []);

  const data = summary;

  return (
    <motion.div
      initial="initial"
      animate="animate"
      variants={stagger}
      className="space-y-8"
    >
      <motion.div variants={fadeInUp} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-l-4 border-fcb-blue pl-4">
        <div className="flex items-start gap-5">
          <img src={crestImg} alt="FC Barcelona" className="h-14 w-14 object-contain shrink-0 hidden sm:block" />
          <div>
            <h1 className="text-3xl font-display tracking-widest text-white uppercase">
              Executive Control Tower
            </h1>
            <p className="text-white/80 mt-1">
              Single pane of glass for sporting and commercial leadership
            </p>
          </div>
        </div>
        {summary.last_updated != null ? (
          <p className="text-xs text-white/50 font-sans tabular-nums shrink-0">
            Last updated: {new Date(String(summary.last_updated)).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        ) : null}
      </motion.div>

      <motion.div variants={fadeInUp}>
        <MatchPreviewHero
          fixture={fixtures[0]}
          lastMatch={
            summary.last_match_opponent
              ? {
                  opponent: String(summary.last_match_opponent),
                  date: String(summary.last_match_date ?? ""),
                  venue: String(summary.last_match_venue ?? ""),
                  score: String(summary.last_match_score ?? ""),
                  is_home: summary.last_match_is_home != null
                    ? Boolean(summary.last_match_is_home)
                    : /estadi ol.mpic/i.test(String(summary.last_match_venue ?? "")),
                }
              : null
          }
        />
      </motion.div>

      <motion.div
        variants={stagger}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-stretch"
      >
        {[
          {
            title: "Squad Readiness",
            value: `${data.squad_readiness}%`,
            subtitle: `${data.available_players} available`,
            icon: <Users className="w-5 h-5" />,
          },
          {
            title: "Match attendance",
            value: data.next_match_attendance?.toLocaleString() ?? "-",
            subtitle: String(data.next_match_opponent ?? ""),
            icon: <Ticket className="w-5 h-5" />,
          },
          {
            title: "Projected Revenue",
            value: `€${data.projected_ticket_revenue_m}M`,
            subtitle: "Next home fixture",
            icon: <TrendingUp className="w-5 h-5" />,
          },
          {
            title: "Injury Risk",
            value: String(data.injury_risk_count ?? 0),
            subtitle: "Players flagged",
            icon: <Heart className="w-5 h-5" />,
          },
          {
            title: "Matchday Weather",
            value: weather ? `${weather.temp_c}°C` : "--",
            subtitle: weather ? `${String(weather.conditions)} • ${Number(weather.attendance_impact_pct ?? 0) >= 0 ? "Neutral" : "Impact"}` : "Live from Open-Meteo",
            icon: <Cloud className="w-5 h-5" />,
          },
        ].map((kpi, i) => (
          <motion.div key={i} variants={fadeInUp} className="h-full min-h-0 flex">
            <KPITile {...kpi} />
          </motion.div>
        ))}
      </motion.div>

      {mlAttendance && (
        <motion.div
          variants={fadeInUp}
          className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass"
        >
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 uppercase tracking-wide">
            <Brain className="w-5 h-5" />
            ML Predictions
          </h2>
          <p className="text-sm text-white/60 mt-1">Attendance model (big opponent, weekend, 18°C)</p>
          <div className="mt-4 flex flex-wrap gap-4">
            <div className="px-4 py-3 rounded-lg bg-white/10 border border-white/15 backdrop-blur-sm min-w-[10rem]">
              <span className="block font-fcb-bebas text-xs text-white/60 uppercase tracking-[0.16em]">
                Predicted
              </span>
              <p className="mt-1 font-fcb-bebas text-3xl sm:text-4xl tracking-[0.14em] text-fcb-yellow leading-[0.95]">
                {(mlAttendance as Record<string, unknown>).predicted_attendance != null
                  ? Number((mlAttendance as Record<string, unknown>).predicted_attendance).toLocaleString()
                  : "—"}
              </p>
              <span className="mt-0.5 block text-xs text-white/50 font-sans normal-case tracking-normal">
                attendance
              </span>
            </div>
            <div className="px-4 py-3 rounded-lg bg-white/10 border border-white/15 backdrop-blur-sm min-w-[12rem]">
              <span className="block font-fcb-bebas text-xs text-white/60 uppercase tracking-[0.16em]">
                Range
              </span>
              <p className="mt-1 font-fcb-bebas text-3xl sm:text-4xl tracking-[0.14em] text-fcb-yellow leading-[0.95]">
                {(mlAttendance as Record<string, unknown>).confidence_low != null &&
                (mlAttendance as Record<string, unknown>).confidence_high != null
                  ? `${Number((mlAttendance as Record<string, unknown>).confidence_low).toLocaleString()} \u2013 ${Number((mlAttendance as Record<string, unknown>).confidence_high).toLocaleString()}`
                  : "—"}
              </p>
              <span className="mt-0.5 block text-xs text-white/50 font-sans normal-case tracking-normal">
                confidence band
              </span>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          variants={fadeInUp}
          className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass"
        >
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 uppercase tracking-wide">
            <AlertTriangle className="w-5 h-5 text-white" />
            Real-Time Alerts
          </h2>
          <div className="mt-4 space-y-3">
            {alerts.map((a, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-3 rounded-lg bg-white/5 border border-white/10"
              >
                <p className="font-medium text-white">{String(a.title)}</p>
                <p className="text-sm text-white/60 mt-1">{String(a.message)}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          variants={fadeInUp}
          className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass"
        >
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 uppercase tracking-wide">
            <Star className="w-5 h-5 text-fcb-yellow" />
            Key Insights
          </h2>
          <div className="mt-4 space-y-3">
            {[
              { label: "Top Transfer Opportunity", value: data.top_transfer_opportunity },
              { label: "Most Marketable Player", value: data.most_marketable_player },
              { label: "Campaign Recommendation", value: data.campaign_recommendation },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="p-3 rounded-lg bg-white/5 border border-white/10"
              >
                <p className="text-sm text-white/60">{item.label}</p>
                <p className="font-medium text-white">{String(item.value)}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      <motion.div
        variants={fadeInUp}
        className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass"
      >
        <h2 className="text-lg font-semibold text-white mb-4 uppercase tracking-wide">Upcoming Fixtures</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-white/60 text-sm uppercase tracking-wide">
                <th className="pb-3">Opponent</th>
                <th className="pb-3">Competition</th>
                <th className="pb-3">Venue</th>
                <th className="pb-3">Date</th>
                <th className="pb-3">Kickoff</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {fixtures.map((f: Record<string, unknown>, i: number) => (
                <motion.tr
                  key={i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.3 + i * 0.05 }}
                  className="border-t border-white/10"
                >
                  <td className="py-3 font-medium text-white">{String(f.opponent)}</td>
                  <td className="py-3 text-white/60">{String(f.competition)}</td>
                  <td className="py-3 text-white/60">{String(f.venue)}</td>
                  <td className="py-3 text-white/60">{String(f.date)}</td>
                  <td className="py-3 text-white/60">{String(f.kickoff)}</td>
                  <td className="py-3">
                    <Link
                      to="/audience"
                      className="text-white text-sm hover:underline flex items-center gap-1 font-medium"
                    >
                      View demand <ArrowRight className="w-4 h-4" />
                    </Link>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      <motion.div
        variants={fadeInUp}
        className="flex items-center gap-4"
      >
        <button
          onClick={openGenie}
          className="inline-flex items-center gap-2 px-6 py-3 bg-fcb-blue text-white font-semibold rounded-lg hover:bg-fcb-blue-dark transition-colors"
        >
          <Bot className="w-5 h-5" />
          Ask Genie
        </button>
        <Link
          to="/simulation"
          className="inline-flex items-center gap-2 px-6 py-3 border border-white/20 text-white rounded-lg hover:bg-white/10 transition-colors font-semibold backdrop-blur-sm"
        >
          <Sliders className="w-5 h-5" />
          Live match planning
        </Link>
      </motion.div>

      <motion.div variants={fadeInUp} className="text-center pt-2">
        <a
          href="https://github.com/databricks-field-eng/dbx-growth-dev/tree/main/core_team/fcb"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-white/50 hover:text-fcb-yellow underline"
        >
          Source: dbx-growth-dev (core_team)
        </a>
      </motion.div>
    </motion.div>
  );
}
