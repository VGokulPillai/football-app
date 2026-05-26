import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Radio, GripVertical, Activity, Bell, Heart, Sparkles } from "lucide-react";
import pitchUrl from "../assets/pitch-vertical.png";
import { api } from "../lib/api";
import { useNotifications } from "../contexts/NotificationContext";
import {
  type FormationId,
  FORMATION_META,
  FORMATION_SLOTS,
  awaySlotsFromHome,
} from "../lib/formationPresets";
import { normalizePlayerName, readinessFromLive } from "../lib/liveSquadHealth";

const MEDIA_BASE = "https://media.api-sports.io/football";
const LA_LIGA = 140;
const SEASON = (() => {
  const d = new Date();
  return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
})();

export type BoardPlayer = {
  id: string;
  name: string;
  position?: string;
  photo?: string;
  readiness?: number;
  healthNote?: string;
  minutesPl?: number;
};

const OPPONENT_NAMES = [
  "Solanke", "Semenyo", "Tavernier", "Cook", "Adams", "Christie", "Smith", "Kelly", "Zabarnyi", "Senesi", "Neto",
];

type DragPayload =
  | { source: "bench"; team: "home" | "away"; playerId: string }
  | { source: "slot"; team: "home" | "away"; index: number };

function roleFromPosition(pos: string): "attacking" | "defensive" | "neutral" {
  const u = pos.toUpperCase();
  if (u.includes("GOAL") || (u.startsWith("G") && u.length <= 3)) return "defensive";
  if (u.includes("DEF") || u === "D" || u.includes("BACK")) return "defensive";
  if (u.includes("STRIKER") || u.includes("ATT") || u === "F" || u.includes("WING")) return "attacking";
  if (u.includes("MID")) {
    if (u.includes("ATT") || u.includes("OFF") || u.includes("CAM")) return "attacking";
    if (u.includes("DEF") || u.includes("HOLD") || u.includes("DM")) return "defensive";
    return "neutral";
  }
  return "neutral";
}

/** Vertical pitch zone for Barça (high % = toward opponent goal). */
function roleFromHomeSlotGeometry(top: number): "attacking" | "defensive" | "neutral" {
  if (top >= 71) return "attacking";
  if (top <= 46) return "defensive";
  return "neutral";
}

/** Opponent uses mirrored coords (low top = toward Barça goal = their attack). */
function roleFromAwaySlotGeometry(top: number): "attacking" | "defensive" | "neutral" {
  if (top <= 29) return "attacking";
  if (top >= 54) return "defensive";
  return "neutral";
}

/**
 * A/D/N on pitch: combines **current slot** (updates on drag) with **live registered position** from API.
 * Clash (e.g. CB dragged high) → neutral “hybrid”.
 */
function tacticalRoleOnPitch(
  team: "home" | "away",
  coord: { top: number; left: number },
  livePosition: string | undefined
): "attacking" | "defensive" | "neutral" {
  const geo = team === "home" ? roleFromHomeSlotGeometry(coord.top) : roleFromAwaySlotGeometry(coord.top);
  const live = roleFromPosition(livePosition ?? "");
  if (geo === live) return geo;
  if (geo === "neutral") return live;
  if (live === "neutral") return geo;
  return "neutral";
}

function benchRoleFromLive(livePosition: string | undefined): "attacking" | "defensive" | "neutral" {
  return roleFromPosition(livePosition ?? "");
}

function avatarSrc(p: BoardPlayer, team: "home" | "away"): string {
  if (p.photo) return p.photo;
  const bg = team === "home" ? "DA291C" : "1e3a8a";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name)}&background=${bg}&color=fff&size=128`;
}

type SlotFatigueRow = { slot: number; fatigue_pct: number; alert?: boolean };

function fatigueBarTone(pct: number): string {
  if (pct >= 75) return "bg-red-500";
  if (pct >= 58) return "bg-amber-400";
  return "bg-emerald-500";
}

function fatigueBorderColor(pct: number, team: "home" | "away"): string {
  if (pct >= 75) return "#ef4444";
  if (pct >= 58) return "#f59e0b";
  return team === "home" ? "#d4af37" : "#1e3a8a";
}

function RoleBadge({
  role,
  hint,
}: {
  role: "attacking" | "defensive" | "neutral";
  hint?: string;
}) {
  const r = role;
  const cls =
    r === "attacking"
      ? "bg-emerald-600 text-white"
      : r === "defensive"
        ? "bg-blue-900 text-white"
        : "bg-slate-600 text-white";
  const ch = r === "attacking" ? "A" : r === "defensive" ? "D" : "N";
  return (
    <span
      className={`absolute -top-1 -left-1 z-20 text-[8px] font-black px-1 py-0 rounded shadow ${cls}`}
      title={
        hint ??
        (r === "attacking" ? "Attacking" : r === "defensive" ? "Defensive" : "Neutral / dual")
      }
    >
      {ch}
    </span>
  );
}

function BiasPill({ bias }: { bias: string }) {
  const b = bias.toLowerCase();
  const cls =
    b === "attacking"
      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
      : b === "defensive"
        ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
        : "bg-white/10 text-white/70 border-white/20";
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cls}`}>
      {bias}
    </span>
  );
}

export default function LiveTacticalBoard() {
  const { notify } = useNotifications();
  const [formationId, setFormationId] = useState<FormationId>("4231");
  const [homeSlots, setHomeSlots] = useState<(BoardPlayer | null)[]>(() => Array(11).fill(null));
  const [awaySlots, setAwaySlots] = useState<(BoardPlayer | null)[]>(() => Array(11).fill(null));
  const [homeBench, setHomeBench] = useState<BoardPlayer[]>([]);
  const [awayBench, setAwayBench] = useState<BoardPlayer[]>([]);
  const [minute, setMinute] = useState(0);
  const [running, setRunning] = useState(false);
  const [tickMs, setTickMs] = useState(400);
  const [subsUsed, setSubsUsed] = useState(0);
  const [liveFeed, setLiveFeed] = useState<Record<string, unknown> | null>(null);
  const [rightTab, setRightTab] = useState<"ml" | "health">("ml");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [freshUntilHome, setFreshUntilHome] = useState<Record<number, number>>({});
  const [freshUntilAway, setFreshUntilAway] = useState<Record<number, number>>({});
  const fatigueNotifySeen = useRef<Set<string>>(new Set());

  const homeCoords = FORMATION_SLOTS[formationId];
  const awayCoords = useMemo(() => awaySlotsFromHome(homeCoords), [homeCoords]);

  /** 11 × A/D/N for `/ml/tactical-live` — follows current XI + slot geometry (drag/swap). */
  const homeSlotRolesParam = useMemo(() => {
    return homeCoords
      .map((coord, i) => {
        const p = homeSlots[i];
        if (!p) return "N";
        const r = tacticalRoleOnPitch("home", coord, p.position);
        if (r === "attacking") return "A";
        if (r === "defensive") return "D";
        return "N";
      })
      .join("");
  }, [homeCoords, homeSlots]);

  const derivedXiBias = useMemo((): "attacking" | "defensive" | "neutral" => {
    const roles = homeSlotRolesParam.split("");
    const ca = roles.filter((c) => c === "A").length;
    const cd = roles.filter((c) => c === "D").length;
    if (ca > cd + 1) return "attacking";
    if (cd > ca + 1) return "defensive";
    return "neutral";
  }, [homeSlotRolesParam]);

  const formationLocked = minute > 0 || running;

  useEffect(() => {
    setLoadError(null);
    Promise.all([
      api.football.barcelona.playerPerformanceLive(SEASON).catch(() => null),
      api.football
        .injuries({ team: 529, league: LA_LIGA, season: SEASON })
        .catch(() => null),
      api.squadValue.squad().catch(() => null),
    ]).then(([bundle, injRes, svRes]) => {
      const injList = (injRes as { response?: Array<Record<string, unknown>> })?.response ?? [];
      const injByName = new Map<string, { type?: string; reason?: string }>();
      injList.forEach((row) => {
        const pl = row.player as Record<string, unknown> | undefined;
        const n = pl?.name != null ? normalizePlayerName(String(pl.name)) : "";
        if (n) injByName.set(n, { type: pl?.type != null ? String(pl.type) : undefined, reason: pl?.reason != null ? String(pl.reason) : undefined });
      });

      const squad = (svRes as { squad?: Array<Record<string, unknown>> } | null)?.squad ?? [];
      const loanOutIds = new Set<number>();
      for (const p of squad) {
        if (p.loan_status === "loan_out" && p.id != null) loanOutIds.add(Number(p.id));
      }

      const rawPlayers = (bundle as { players?: Array<Record<string, unknown>>; ok?: boolean })?.players;
      if (!Array.isArray(rawPlayers) || rawPlayers.length === 0) {
        setLoadError(
          (bundle as { error?: string })?.error ??
            "Live squad stats unavailable (check API_FOOTBALL_KEY). Using empty board."
        );
        return;
      }

      const activePlayers =
        loanOutIds.size > 0
          ? rawPlayers.filter((row) => !loanOutIds.has(Number(row.player_id)))
          : rawPlayers;

      const list: BoardPlayer[] = activePlayers.map((row) => {
        const name = String(row.name ?? "?");
        const low = normalizePlayerName(name);
        const pid = row.player_id;
        const pos = String(row.position ?? "");
        const mins = Number(row.minutes ?? 0);
        const inj = injByName.get(low);
        return {
          id: String(pid ?? name),
          name,
          position: pos,
          photo: typeof row.photo === "string" ? row.photo : `${MEDIA_BASE}/players/${pid}.png`,
          minutesPl: mins,
          readiness: readinessFromLive(mins, inj),
          healthNote: inj
            ? [inj.type, inj.reason].filter(Boolean).join(" · ") || "Listed on injury feed"
            : undefined,
        };
      });

      list.sort((a, b) => (b.minutesPl ?? 0) - (a.minutesPl ?? 0));
      const xi = list.slice(0, 11);
      const bench = list.slice(11);
      while (xi.length < 11) {
        xi.push({
          id: `fill-${xi.length}`,
          name: `Squad ${xi.length + 1}`,
          position: "Midfielder",
          readiness: 80,
        });
      }
      setHomeSlots(xi.map((p) => p));
      setHomeBench(bench.length ? bench : []);

      const away: BoardPlayer[] = OPPONENT_NAMES.slice(0, 11).map((n, i) => ({
        id: `opp-${i}`,
        name: n,
        position: i < 4 ? "Defender" : i < 9 ? "Midfielder" : "Attacker",
      }));
      setAwaySlots(away);
      setAwayBench(
        OPPONENT_NAMES.slice(11, 16).map((n, i) => ({
          id: `opp-b-${i}`,
          name: n,
          position: "Midfielder",
        }))
      );
    });
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setMinute((m) => {
        if (m >= 90) {
          setRunning(false);
          return 90;
        }
        return m + 1;
      });
    }, tickMs);
    return () => window.clearInterval(id);
  }, [running, tickMs]);

  const fatigueSlotsParam = useMemo(() => {
    const raw = liveFeed?.home_fatigue_by_slot;
    if (!Array.isArray(raw) || minute <= 0) return undefined;
    const rows = raw as SlotFatigueRow[];
    return rows
      .filter((x) => typeof x.slot === "number" && typeof x.fatigue_pct === "number" && x.fatigue_pct >= 68)
      .sort((a, b) => b.fatigue_pct - a.fatigue_pct)
      .slice(0, 5)
      .map((x) => x.slot)
      .join(",");
  }, [liveFeed, minute]);

  useEffect(() => {
    let cancelled = false;
    api.ml
      .tacticalLive(minute, subsUsed, formationId, fatigueSlotsParam, homeSlotRolesParam)
      .then((d) => {
        if (!cancelled) setLiveFeed(d);
      })
      .catch(() => {
        if (!cancelled) setLiveFeed(null);
      });
    return () => {
      cancelled = true;
    };
  }, [minute, subsUsed, formationId, fatigueSlotsParam, homeSlotRolesParam]);

  const homeFatigueBySlot = useMemo(() => {
    const raw = liveFeed?.home_fatigue_by_slot;
    if (!Array.isArray(raw)) return new Map<number, SlotFatigueRow>();
    const m = new Map<number, SlotFatigueRow>();
    (raw as SlotFatigueRow[]).forEach((row) => {
      if (typeof row.slot === "number" && typeof row.fatigue_pct === "number") m.set(row.slot, row);
    });
    return m;
  }, [liveFeed]);

  const awayFatigueBySlot = useMemo(() => {
    const raw = liveFeed?.away_fatigue_by_slot;
    if (!Array.isArray(raw)) return new Map<number, SlotFatigueRow>();
    const m = new Map<number, SlotFatigueRow>();
    (raw as SlotFatigueRow[]).forEach((row) => {
      if (typeof row.slot === "number" && typeof row.fatigue_pct === "number") m.set(row.slot, row);
    });
    return m;
  }, [liveFeed]);

  const displayHomeFatigue = useCallback(
    (slot: number, raw: number) => {
      const until = freshUntilHome[slot];
      if (until !== undefined && minute < until) return Math.max(12, Math.round(raw * 0.42));
      return raw;
    },
    [freshUntilHome, minute]
  );

  const displayAwayFatigue = useCallback(
    (slot: number, raw: number) => {
      const until = freshUntilAway[slot];
      if (until !== undefined && minute < until) return Math.max(12, Math.round(raw * 0.42));
      return raw;
    },
    [freshUntilAway, minute]
  );

  const priorityHomeNames = useMemo(() => {
    const slots = liveFeed?.priority_home_sub_slots;
    if (!Array.isArray(slots)) return [];
    return (slots as number[])
      .map((i) => homeSlots[i]?.name)
      .filter((n): n is string => Boolean(n));
  }, [liveFeed, homeSlots]);

  const subSuggestions = (liveFeed?.sub_suggestions ?? []) as Array<Record<string, unknown>>;

  useEffect(() => {
    if (minute === 0) {
      fatigueNotifySeen.current.clear();
      return;
    }
    if (minute < 22 || !liveFeed) return;
    const rows = liveFeed.home_fatigue_by_slot;
    if (!Array.isArray(rows)) return;

    for (const row of rows as SlotFatigueRow[]) {
      const slot = row.slot;
      const player = homeSlots[slot];
      if (!player) continue;
      const raw = typeof row.fatigue_pct === "number" ? row.fatigue_pct : 0;
      const shown = displayHomeFatigue(slot, raw);
      if (shown < 73) continue;
      const windowKey = `${player.id}-${Math.floor(minute / 8)}`;
      if (fatigueNotifySeen.current.has(windowKey)) continue;
      fatigueNotifySeen.current.add(windowKey);
      notify({
        type: "warning",
        title: `Fatigue: ${player.name} (${shown}%)`,
        message: "Drag a fresher player from the Barça bench onto this pitch slot to substitute.",
        duration: 9500,
      });
    }
  }, [minute, liveFeed, homeSlots, notify, displayHomeFatigue]);

  const onDragStart = (e: React.DragEvent, payload: DragPayload) => {
    e.dataTransfer.setData("application/json", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "move";
  };

  const applyHomeSub = useCallback((incoming: BoardPlayer, slotIndex: number, previous: BoardPlayer | null) => {
    setHomeSlots((slots) => {
      const next = [...slots];
      next[slotIndex] = incoming;
      return next;
    });
    setHomeBench((b) => {
      const without = b.filter((p) => p.id !== incoming.id);
      if (previous) return [...without, previous];
      return without;
    });
    if (minute > 0 && previous?.id !== incoming.id) {
      setSubsUsed((s) => Math.min(5, s + 1));
    }
    setFreshUntilHome((prev) => ({ ...prev, [slotIndex]: minute + 20 }));
  }, [minute]);

  const applyAwaySub = useCallback((incoming: BoardPlayer, slotIndex: number, previous: BoardPlayer | null) => {
    setAwaySlots((slots) => {
      const next = [...slots];
      next[slotIndex] = incoming;
      return next;
    });
    setAwayBench((b) => {
      const without = b.filter((p) => p.id !== incoming.id);
      if (previous) return [...without, previous];
      return without;
    });
    setFreshUntilAway((prev) => ({ ...prev, [slotIndex]: minute + 20 }));
  }, [minute]);

  const swapHomeSlots = useCallback((i: number, j: number) => {
    setHomeSlots((slots) => {
      const next = [...slots];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  const onDropHomeSlot = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    let raw: DragPayload;
    try {
      raw = JSON.parse(e.dataTransfer.getData("application/json") || "{}");
    } catch {
      return;
    }
    const current = homeSlots[slotIndex];
    if (raw.source === "bench" && raw.team === "home") {
      const player = homeBench.find((p) => p.id === raw.playerId);
      if (!player) return;
      applyHomeSub(player, slotIndex, current);
      return;
    }
    if (raw.source === "slot" && raw.team === "home" && raw.index !== slotIndex) {
      swapHomeSlots(raw.index, slotIndex);
    }
  };

  const onDropAwaySlot = (e: React.DragEvent, slotIndex: number) => {
    e.preventDefault();
    let raw: DragPayload;
    try {
      raw = JSON.parse(e.dataTransfer.getData("application/json") || "{}");
    } catch {
      return;
    }
    const current = awaySlots[slotIndex];
    if (raw.source === "bench" && raw.team === "away") {
      const player = awayBench.find((p) => p.id === raw.playerId);
      if (!player) return;
      applyAwaySub(player, slotIndex, current);
      return;
    }
    if (raw.source === "slot" && raw.team === "away" && raw.index !== slotIndex) {
      setAwaySlots((slots) => {
        const next = [...slots];
        [next[raw.index], next[slotIndex]] = [next[slotIndex], next[raw.index]];
        return next;
      });
    }
  };

  const recs = (liveFeed?.recommendations ?? []) as Array<Record<string, unknown>>;

  const phaseLabel = useMemo(() => {
    if (minute <= 0) return "Pre-match";
    if (minute < 45) return "1st half";
    if (minute === 45) return "Half-time";
    if (minute <= 90) return "2nd half";
    return "Full time";
  }, [minute]);

  const applyMlFormation = () => {
    const rec = liveFeed?.ml_recommended_formation_id;
    const id = String(rec ?? "433") as FormationId;
    if (id in FORMATION_SLOTS) setFormationId(id);
    notify({
      type: "info",
      title: "ML formation applied",
      message: String(liveFeed?.ml_formation_rationale ?? "Shape updated — review XI on the pitch."),
      duration: 6000,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white/[0.10] backdrop-blur-xl border border-white/15 shadow-glass">
        <div className="flex items-center gap-3">
          <Radio className="w-6 h-6 text-fcb-yellow animate-pulse" />
          <div>
            <p className="text-xs uppercase tracking-wider text-white/50">Live planning stream</p>
            <p className="text-2xl font-clock tabular-nums font-bold text-white">
              {minute}′{" "}
              <span className="text-lg text-white/80 font-sans font-semibold">{phaseLabel}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={tickMs}
            onChange={(e) => setTickMs(Number(e.target.value))}
            className="text-sm bg-white/10 border border-white/15 rounded-lg px-2 py-1.5"
          >
            <option value={800}>Slow</option>
            <option value={400}>1×</option>
            <option value={200}>2×</option>
            <option value={100}>4×</option>
          </select>
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-fcb-blue text-white text-sm font-semibold hover:opacity-90"
          >
            {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {running ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMinute(0);
              setRunning(false);
              setSubsUsed(0);
              setFormationId("4231");
              setFreshUntilHome({});
              setFreshUntilAway({});
              fatigueNotifySeen.current.clear();
            }}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-white/20 text-sm"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <span className="text-xs text-white/50">Subs: {subsUsed}/5</span>
          {typeof liveFeed?.fatigue_index === "number" ? (
            <span className="text-xs text-white/60 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 border border-white/15">
              <Activity className="w-3.5 h-3.5 text-amber-600" />
              Squad fatigue index {Math.round(Number(liveFeed.fatigue_index) * 100)}%
            </span>
          ) : null}
        </div>
      </div>

      {/* Pre-match: formation + ML (locked after kick-off) */}
      <div className="rounded-xl border border-white/[0.12] bg-white/[0.08] backdrop-blur-xl p-4 shadow-glass space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="w-5 h-5 text-fcb-yellow shrink-0" />
          <h3 className="text-sm font-display uppercase tracking-wide text-fcb-yellow">Formation &amp; ML (pre-kick)</h3>
          {formationLocked ? (
            <span className="text-xs text-white/50">Locked during simulation — reset to change shape.</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-white/50 block mb-1">Shape on pitch</label>
            <select
              value={formationId}
              disabled={formationLocked}
              onChange={(e) => setFormationId(e.target.value as FormationId)}
              className="text-sm bg-white/10 border border-white/15 rounded-lg px-2 py-2 min-w-[10rem] disabled:opacity-50"
            >
              {(Object.keys(FORMATION_META) as FormationId[]).map((id) => (
                <option key={id} value={id}>
                  {FORMATION_META[id].label} — {FORMATION_META[id].short}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-white/50 uppercase tracking-wide whitespace-nowrap">Shape</span>
            <BiasPill bias={FORMATION_META[formationId].bias} />
            <span className="text-white/20 select-none" aria-hidden>
              ·
            </span>
            <span className="text-[10px] text-white/50 uppercase tracking-wide whitespace-nowrap">Current XI</span>
            <BiasPill bias={derivedXiBias} />
          </div>
          <button
            type="button"
            disabled={formationLocked}
            onClick={applyMlFormation}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-white/20 text-white text-xs font-semibold hover:opacity-90 disabled:opacity-40"
          >
            Apply ML formation
          </button>
        </div>
        {liveFeed?.ml_formation_rationale ? (
          <p className="text-xs text-white/80 leading-relaxed">
            <strong className="text-fcb-yellow">ML suggestion ({String(liveFeed.ml_recommended_formation_id)}):</strong>{" "}
            {String(liveFeed.ml_formation_rationale)}
          </p>
        ) : null}
        <p className="text-[11px] text-white/50">
          Player photos and readiness use <strong>live API-Football</strong> (PL minutes + injury list). On the pitch,{" "}
          <strong>A / D / N</strong> blends <strong>slot height</strong> (moves when you drag) with{" "}
          <strong>registered position</strong> from the API; mismatch → <strong>N</strong> (hybrid).{" "}
          <strong>Current XI</strong> is the aggregate of those roles — ML subs and the live feed update when you swap
          players or slots.
        </p>
      </div>

      {loadError ? (
        <div className="text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">{loadError}</div>
      ) : null}

      {minute >= 18 && priorityHomeNames.length > 0 ? (
        <div
          role="status"
          className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 backdrop-blur-xl px-4 py-3 text-sm text-amber-200 shadow-sm"
        >
          <Bell className="w-5 h-5 text-amber-400 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">Sub priority (fatigue):</strong>{" "}
            {priorityHomeNames.join(" · ")} — use bench drag-and-drop on those pitch slots first.
          </span>
        </div>
      ) : null}

      <div className="text-xs text-white/50 -mt-2">
        Drag players between pitch slots to reshuffle. Drag from <strong>bench</strong> onto a starter to substitute
        (counts after kick-off). Open <strong>Squad health</strong> for live readiness + sim fatigue side-by-side.
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-4 min-w-0">
          <div className="relative mx-auto w-full max-w-md aspect-[2/3] rounded-2xl overflow-hidden border-4 border-white shadow-2xl ring-2 ring-fcb-blue/20">
            <img src={pitchUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute top-2 left-0 right-0 text-center pointer-events-none">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/90 drop-shadow-md bg-black/30 px-2 py-0.5 rounded">
                Opponent — press / low block
              </span>
            </div>
            <div className="absolute bottom-2 left-0 right-0 text-center pointer-events-none">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/90 drop-shadow-md bg-black/30 px-2 py-0.5 rounded">
                FC Barcelona · {FORMATION_META[formationId].label}
              </span>
            </div>

            {awayCoords.map((pos, i) => {
              const awayRow = awayFatigueBySlot.get(i);
              const awayRaw = awayRow?.fatigue_pct ?? Math.min(95, 20 + minute);
              const awayPct = displayAwayFatigue(i, awayRaw);
              const awayAlert = Boolean(awayRow?.alert) || awayPct >= 72;
              return (
                <div
                  key={`a-${i}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center w-[3rem] sm:w-[3.25rem]"
                  style={{ top: `${pos.top}%`, left: `${pos.left}%` }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDropAwaySlot(e, i)}
                >
                  {awaySlots[i] && (
                    <>
                      <div
                        draggable
                        onDragStart={(e) =>
                          onDragStart(e, { source: "slot", team: "away", index: i })
                        }
                        className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-full shadow-lg overflow-hidden cursor-grab active:cursor-grabbing bg-slate-800 border-[3px] box-content ${
                          awayAlert ? "ring-2 ring-amber-300 ring-offset-1 ring-offset-black/40 animate-pulse" : ""
                        }`}
                        style={{ borderColor: fatigueBorderColor(awayPct, "away") }}
                        title={`${awaySlots[i]!.name} — fatigue ${awayPct}%`}
                      >
                        <RoleBadge
                          role={tacticalRoleOnPitch("away", awayCoords[i], awaySlots[i]?.position)}
                          hint={`Slot + live: ${awaySlots[i]?.position ?? "?"}`}
                        />
                        <img
                          src={avatarSrc(awaySlots[i]!, "away")}
                          alt=""
                          className="w-full h-full object-cover"
                          draggable={false}
                          onError={(ev) => {
                            ev.currentTarget.src = avatarSrc({ ...awaySlots[i]!, photo: undefined }, "away");
                          }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/55">
                          <div
                            className={`h-full ${fatigueBarTone(awayPct)}`}
                            style={{ width: `${awayPct}%` }}
                          />
                        </div>
                        <GripVertical className="absolute bottom-0.5 right-0 w-3 h-3 text-white/80 drop-shadow pointer-events-none" />
                      </div>
                      <span className="mt-0.5 text-[9px] font-bold text-white tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                        {awayPct}%
                      </span>
                    </>
                  )}
                </div>
              );
            })}

            {homeCoords.map((pos, i) => {
              const homeRow = homeFatigueBySlot.get(i);
              const homeRaw = homeRow?.fatigue_pct ?? Math.min(95, 20 + minute);
              const homePct = displayHomeFatigue(i, homeRaw);
              const homeAlert = Boolean(homeRow?.alert) || homePct >= 72;
              return (
                <div
                  key={`h-${i}`}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center w-[3rem] sm:w-[3.25rem]"
                  style={{ top: `${pos.top}%`, left: `${pos.left}%` }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => onDropHomeSlot(e, i)}
                >
                  {homeSlots[i] && (
                    <>
                      <div
                        draggable
                        onDragStart={(e) =>
                          onDragStart(e, { source: "slot", team: "home", index: i })
                        }
                        className={`relative w-11 h-11 sm:w-12 sm:h-12 rounded-full shadow-lg overflow-hidden cursor-grab active:cursor-grabbing bg-fcb-blue/30 border-[3px] box-content ${
                          homeAlert ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-black/30 animate-pulse" : ""
                        }`}
                        style={{ borderColor: fatigueBorderColor(homePct, "home") }}
                        title={`${homeSlots[i]!.name} — fatigue ${homePct}%`}
                      >
                        <RoleBadge
                          role={tacticalRoleOnPitch("home", homeCoords[i], homeSlots[i]?.position)}
                          hint={`Slot on pitch × API position (${homeSlots[i]?.position ?? "?"}) — updates when you drag`}
                        />
                        <img
                          src={avatarSrc(homeSlots[i]!, "home")}
                          alt=""
                          className="w-full h-full object-cover"
                          draggable={false}
                          onError={(ev) => {
                            ev.currentTarget.src = avatarSrc({ ...homeSlots[i]!, photo: undefined }, "home");
                          }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/55">
                          <div
                            className={`h-full ${fatigueBarTone(homePct)}`}
                            style={{ width: `${homePct}%` }}
                          />
                        </div>
                      </div>
                      <span className="mt-0.5 text-[9px] font-bold text-white tabular-nums drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                        {homePct}%
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/[0.08] backdrop-blur-xl border border-white/30">
              <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                Barça bench — drag onto pitch to sub
              </h3>
              <div className="flex flex-wrap gap-2">
                {homeBench.map((p) => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, { source: "bench", team: "home", playerId: p.id })}
                    className="relative flex items-center gap-1 px-1 py-1 rounded-lg bg-white/10 border border-white/15 cursor-grab active:cursor-grabbing"
                  >
                    <RoleBadge
                      role={benchRoleFromLive(p.position)}
                      hint={`Bench — from live API position (${p.position ?? "?"})`}
                    />
                    <img
                      src={avatarSrc(p, "home")}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover border border-fcb-blue/40"
                      draggable={false}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium text-white/90 max-w-[5.5rem] truncate">{p.name}</span>
                      <span className="text-[10px] text-white/50">{p.readiness ?? "—"}% ready</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.08] backdrop-blur-xl border border-white/30">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">Opponent bench</h3>
              <div className="flex flex-wrap gap-2">
                {awayBench.map((p) => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, { source: "bench", team: "away", playerId: p.id })}
                    className="flex items-center gap-1 px-1 py-1 rounded-lg bg-white/10 border border-white/15 cursor-grab active:cursor-grabbing"
                  >
                    <img
                      src={avatarSrc(p, "away")}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover border border-blue-900/40"
                      draggable={false}
                    />
                    <span className="text-xs font-medium max-w-[5rem] truncate">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: ML + typed subs OR squad health */}
        <div className="space-y-2 xl:sticky xl:top-24 self-start">
          <div className="flex rounded-lg border border-white/15 overflow-hidden bg-white/10 p-0.5">
            <button
              type="button"
              onClick={() => setRightTab("ml")}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-md ${
                rightTab === "ml" ? "bg-white/20 shadow text-white" : "text-white/60"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              ML &amp; subs
            </button>
            <button
              type="button"
              onClick={() => setRightTab("health")}
              className={`flex-1 flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-md ${
                rightTab === "health" ? "bg-white/20 shadow text-white" : "text-white/60"
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              Squad health
            </button>
          </div>

          {rightTab === "ml" ? (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-white/[0.06] backdrop-blur-xl border border-white/15 shadow-glass">
                <h3 className="text-sm font-display tracking-wide uppercase text-white mb-1">Typed sub ideas</h3>
                <p className="text-[10px] text-white/50 mb-2">
                  After kick-off, suggestions use sim fatigue + slot role (attacking / defensive / neutral bench profile).
                </p>
                <ul className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {subSuggestions.length === 0 ? (
                    <li className="text-xs text-white/50">Run the clock to surface fatigue-linked sub profiles.</li>
                  ) : (
                    subSuggestions.map((s, idx) => {
                      const slot = s.take_off_slot;
                      const name =
                        typeof slot === "number" ? homeSlots[slot]?.name ?? `Slot ${slot}` : "—";
                      const prof = String(s.bench_profile ?? "neutral");
                      const pill =
                        prof === "defensive"
                          ? "bg-blue-500/20 text-blue-300 border-blue-500/40"
                          : prof === "attacking"
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : "bg-white/10 text-white/70 border-white/20";
                      return (
                        <li
                          key={String(s.id ?? idx)}
                          className="p-2.5 rounded-lg bg-white/[0.10] backdrop-blur-xl border border-white/15 text-xs shadow-glass-sm"
                        >
                          <div className="flex flex-wrap items-center gap-1 mb-1">
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${pill}`}>
                              {prof}
                            </span>
                            <span className="font-semibold text-white truncate">{String(s.label)}</span>
                          </div>
                          <p className="text-white/60 leading-snug">
                            Off: <strong>{name}</strong> — {String(s.detail)}
                          </p>
                          <span className="text-[10px] text-emerald-700">
                            {Math.round(Number(s.confidence ?? 0) * 100)}% conf.
                          </span>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.06] backdrop-blur-xl border border-white/15 shadow-glass">
                <h3 className="text-sm font-display tracking-wide uppercase text-white mb-1">ML live recommendations</h3>
                <p className="text-xs text-white/50 mb-3">
                  Clock, formation choice &amp; subs — discuss in Ask Genie for deeper tactical context.
                </p>
                <ul className="space-y-3 max-h-[min(50vh,360px)] overflow-y-auto pr-1">
                  {recs.map((r, idx) => (
                    <li
                      key={String(r.id ?? idx)}
                      className="p-3 rounded-lg bg-white/[0.08] backdrop-blur-xl border border-white/15 text-sm shadow-sm"
                    >
                      <div className="flex justify-between gap-2">
                        <span className="font-semibold text-white">{String(r.title)}</span>
                        <span className="text-xs text-emerald-400 shrink-0">
                          {Math.round(Number(r.confidence ?? 0) * 100)}% conf.
                        </span>
                      </div>
                      <p className="text-white/60 text-xs mt-1 leading-relaxed">{String(r.detail)}</p>
                      <span className="inline-block mt-1 text-[10px] uppercase tracking-wider text-surface-400">
                        {String(r.type ?? "note")}
                      </span>
                    </li>
                  ))}
                </ul>
                {typeof liveFeed?.stream_note === "string" && liveFeed.stream_note.trim() !== "" ? (
                  <p className="text-[10px] text-surface-400 mt-2">{liveFeed.stream_note}</p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-white/[0.08] backdrop-blur-xl border border-white/15 shadow-glass max-h-[min(85vh,720px)] overflow-y-auto">
              <h3 className="text-sm font-display uppercase tracking-wide text-white mb-1">Squad health</h3>
              <p className="text-[10px] text-white/50 mb-3">
                Live readiness from PL minutes + API injury list. Sim fatigue (match) shows once the clock is running.
              </p>
              <ul className="space-y-3">
                {homeSlots.map((p, slot) => {
                  if (!p) return null;
                  const pitchRole = tacticalRoleOnPitch("home", homeCoords[slot], p.position);
                  return (
                    <li key={`xi-${p.id}`} className="flex gap-2 border-b border-surface-100 pb-3">
                      <img
                        src={avatarSrc(p, "home")}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover border border-fcb-blue/30 shrink-0"
                        onError={(e) => {
                          e.currentTarget.src = avatarSrc({ ...p, photo: undefined }, "home");
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="font-semibold text-sm text-white truncate">{p.name}</span>
                          <BiasPill bias={pitchRole} />
                        </div>
                        <p className="text-[10px] text-white/50">XI · slot {slot}</p>
                        {p.healthNote ? (
                          <p className="text-[10px] text-rose-700 mt-0.5">{p.healthNote}</p>
                        ) : (
                          <p className="text-[10px] text-emerald-700 mt-0.5">Not on current injury feed</p>
                        )}
                        <div className="mt-1 space-y-1">
                          <div className="flex justify-between text-[10px] text-white/60">
                            <span>Live readiness</span>
                            <span>{p.readiness ?? "—"}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${p.readiness ?? 0}%` }}
                            />
                          </div>
                          {minute > 0 ? (
                            <>
                              <div className="flex justify-between text-[10px] text-white/60 pt-1">
                                <span>Sim fatigue</span>
                                <span>
                                  {displayHomeFatigue(
                                    slot,
                                    homeFatigueBySlot.get(slot)?.fatigue_pct ?? Math.min(95, 20 + minute)
                                  )}
                                  %
                                </span>
                              </div>
                              <div className="h-1.5 rounded-full bg-white/10">
                                <div
                                  className={`h-full rounded-full ${fatigueBarTone(
                                    displayHomeFatigue(
                                      slot,
                                      homeFatigueBySlot.get(slot)?.fatigue_pct ?? Math.min(95, 20 + minute)
                                    )
                                  )}`}
                                  style={{
                                    width: `${displayHomeFatigue(
                                      slot,
                                      homeFatigueBySlot.get(slot)?.fatigue_pct ?? Math.min(95, 20 + minute)
                                    )}%`,
                                  }}
                                />
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
                {homeBench.map((p) => (
                  <li key={`bn-${p.id}`} className="flex gap-2 border-b border-surface-100 pb-3 opacity-95">
                    <img
                      src={avatarSrc(p, "home")}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover border border-white/15 shrink-0"
                      onError={(e) => {
                        e.currentTarget.src = avatarSrc({ ...p, photo: undefined }, "home");
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-medium text-sm text-white/90 truncate">{p.name}</span>
                        <span className="text-[9px] uppercase text-surface-400">Bench</span>
                      </div>
                      {p.healthNote ? (
                        <p className="text-[10px] text-rose-700 mt-0.5">{p.healthNote}</p>
                      ) : null}
                      <div className="mt-1">
                        <div className="flex justify-between text-[10px] text-white/60">
                          <span>Readiness</span>
                          <span>{p.readiness ?? "—"}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 mt-0.5">
                          <div
                            className="h-full rounded-full bg-sky-500"
                            style={{ width: `${p.readiness ?? 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
