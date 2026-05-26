import { useEffect, useMemo, useState } from "react";
import { Timer } from "lucide-react";

export type NextFixture = {
  opponent?: string;
  competition?: string;
  venue?: string;
  date?: string;
  kickoff?: string;
  fixture_datetime_iso?: string;
  is_home?: boolean;
  venue_image_url?: string;
};

function parseKickoff(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  const dp = dateStr.split("-").map(Number);
  const tp = timeStr.split(":").map(Number);
  if (dp.length < 3 || tp.length < 2) return null;
  const [y, m, d] = dp;
  const [hh, mm] = tp;
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) return null;
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const timePart = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return d > 0 ? `${d}d ${timePart}` : timePart;
}

function formatKickoffLine(dateStr: string, timeStr: string): string {
  const d = parseKickoff(dateStr, timeStr);
  if (!d) return `${dateStr} · Kick off ${timeStr}`;
  const weekday = d.toLocaleDateString("en-GB", { weekday: "long" });
  const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return `${weekday} ${day} · Kick off ${timeStr || "20:00"}`;
}

function opponentDisplayName(name: string): string {
  return name.replace(/\s+f\.?c\.?$/i, "").trim().toUpperCase();
}

export type LastMatch = {
  opponent?: string;
  date?: string;
  venue?: string;
  score?: string;
  is_home?: boolean;
};

export default function MatchPreviewHero({
  fixture,
  lastMatch,
}: {
  fixture: NextFixture | null | undefined;
  lastMatch?: LastMatch | null;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const kickoff = useMemo(() => {
    const iso = fixture?.fixture_datetime_iso;
    if (iso && /^\d{4}-\d{2}-\d{2}T[\d:.]+/.test(iso)) {
      const d = new Date(iso);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return parseKickoff(String(fixture?.date ?? ""), String(fixture?.kickoff ?? ""));
  }, [fixture?.date, fixture?.kickoff, fixture?.fixture_datetime_iso]);

  const diffMs = kickoff ? kickoff.getTime() - now.getTime() : null;
  const showCountdown = diffMs != null && diffMs > 0;
  const clockStr = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const mainTime = showCountdown && diffMs != null ? formatCountdown(diffMs) : clockStr;
  const timeLabel = showCountdown ? "Countdown to kick-off" : "Local time";

  const opponent = fixture?.opponent ? opponentDisplayName(String(fixture.opponent)) : "OPPONENT";
  const comp = fixture?.competition ? String(fixture.competition) : "La Liga";
  const meta =
    fixture?.date && fixture?.kickoff
      ? formatKickoffLine(String(fixture.date), String(fixture.kickoff))
      : fixture?.date
        ? formatKickoffLine(String(fixture.date), "20:00")
        : "Fixture TBC";

  const homeVenue = "Spotify Camp Nou";
  const isHome = fixture?.is_home ?? new RegExp(homeVenue, "i").test(String(fixture?.venue ?? ""));
  const heroImage = isHome
    ? "/images/camp-nou-sunset.png"
    : (fixture?.venue_image_url || "/images/camp-nou-sunset.png");

  const shortName = "FCB";
  const leftTeam = isHome ? shortName : opponent;
  const rightTeam = isHome ? opponent : shortName;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/20 shadow-glass-lg min-h-[280px] md:min-h-[340px]">
      <img
        src={heroImage}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-[50%_35%]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/35" />
      <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center px-4 py-6 md:px-8 md:py-8 text-center">
        <p className="text-[10px] md:text-xs font-semibold tracking-[0.25em] text-white/90 uppercase">
          {comp}
        </p>
        <p className="mt-1 text-xs md:text-sm text-white/80 font-medium tracking-wide">{meta}</p>

        {/* Match-centre style clock — countdown before kick-off, then live local time */}
        <div
          className="mt-5 flex items-center gap-3 rounded-lg bg-zinc-900/85 px-4 py-2.5 md:px-5 md:py-3 border border-white/15 shadow-lg backdrop-blur-sm"
          title={timeLabel}
        >
          <Timer className="h-5 w-5 md:h-6 md:w-6 text-white shrink-0" strokeWidth={2} />
          <div className="text-left">
            <span className="block text-[9px] uppercase tracking-wider text-white/55 leading-none mb-0.5">
              {timeLabel}
            </span>
            <span className="font-clock text-xl md:text-2xl tabular-nums tracking-wider text-white">
              {mainTime}
            </span>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:gap-8 w-full max-w-4xl">
          <span className="font-fcb-bebas text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white drop-shadow-md max-w-[45%] leading-none tracking-[0.1em]">
            {leftTeam}
          </span>
          <span className="text-white/50 text-sm md:text-base lowercase font-sans tracking-normal px-1">
            vs
          </span>
          <span className="font-fcb-bebas text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white drop-shadow-md max-w-[45%] leading-none tracking-[0.1em]">
            {rightTeam}
          </span>
        </div>

        {lastMatch && (
          <p className="mt-2 text-[10px] text-white/50 font-sans">
            Last: {String(lastMatch.opponent)} ({lastMatch.is_home ? "H" : "A"}) {lastMatch.score ?? ""}
          </p>
        )}
        {fixture?.venue && (
          <p className="mt-1 text-xs text-white/60 font-sans max-w-lg">{String(fixture.venue)}</p>
        )}
      </div>
    </div>
  );
}
