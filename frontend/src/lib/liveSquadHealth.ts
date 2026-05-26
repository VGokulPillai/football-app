/** Live squad health from API-Football (La Liga minutes + injuries) + optional loan-out filter from squad-value API. */

export type HealthDisplayRow = {
  player_id: number;
  player_name: string;
  status: string;
  injury_risk: "Low" | "Medium" | "High";
  fatigue: number;
  training_load: number;
  pl_minutes: number;
  readiness: number;
};

export function laLigaSeasonYear(): number {
  const d = new Date();
  return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
}

/** @deprecated use laLigaSeasonYear */
export const premierLeagueSeasonYear = laLigaSeasonYear;

export function normalizePlayerName(n: string): string {
  return n.toLowerCase().trim();
}

export function readinessFromLive(minutes: number, inj?: { type?: string; reason?: string } | null): number {
  let r = 94;
  if (inj) r -= 38;
  r -= Math.min(30, Math.floor(minutes / 170));
  return Math.max(6, Math.min(100, r));
}

export function buildActiveSquadHealth(
  bundle: Record<string, unknown> | null | undefined,
  injRes: Record<string, unknown> | null | undefined,
  squadValueRes: Record<string, unknown> | null | undefined
): { rows: HealthDisplayRow[]; ok: boolean; error?: string } {
  const ok = bundle?.ok === true;
  const rawPlayers = bundle?.players;
  if (!ok || !Array.isArray(rawPlayers) || rawPlayers.length === 0) {
    return {
      rows: [],
      ok: false,
      error: typeof bundle?.error === "string" ? bundle.error : "Live squad data unavailable.",
    };
  }

  const injList = (injRes as { response?: unknown[] })?.response;
  const injByName = new Map<string, { type?: string; reason?: string }>();
  if (Array.isArray(injList)) {
    for (const row of injList) {
      const r = row as Record<string, unknown>;
      const pl = r.player as Record<string, unknown> | undefined;
      const n = pl?.name != null ? normalizePlayerName(String(pl.name)) : "";
      if (n) {
        injByName.set(n, {
          type: pl?.type != null ? String(pl.type) : undefined,
          reason: pl?.reason != null ? String(pl.reason) : undefined,
        });
      }
    }
  }

  const squad = (squadValueRes?.squad as Array<Record<string, unknown>> | undefined) ?? [];
  const loanOutIds = new Set<number>();
  for (const p of squad) {
    if (p.loan_status === "loan_out" && p.id != null) {
      loanOutIds.add(Number(p.id));
    }
  }

  const rows: HealthDisplayRow[] = [];
  for (const row of rawPlayers as Array<Record<string, unknown>>) {
    const pid = Number(row.player_id);
    if (!Number.isFinite(pid)) continue;
    if (loanOutIds.size > 0 && loanOutIds.has(pid)) continue;

    const name = String(row.name ?? "?");
    const low = normalizePlayerName(name);
    const inj = injByName.get(low);
    const minutes = Number(row.minutes ?? 0);
    const readiness = readinessFromLive(minutes, inj);
    const fatigue = Math.min(100, Math.max(0, 100 - readiness));
    const training_load = Math.min(98, Math.round(38 + minutes / 4));

    let injury_risk: "Low" | "Medium" | "High" = "Low";
    if (inj) injury_risk = "High";
    else if (readiness < 58) injury_risk = "Medium";

    const status = inj ? [inj.type, inj.reason].filter(Boolean).join(" · ") || "Injury list" : "Available";

    rows.push({
      player_id: pid,
      player_name: name,
      status,
      injury_risk,
      fatigue,
      training_load,
      pl_minutes: minutes,
      readiness,
    });
  }

  rows.sort((a, b) => b.pl_minutes - a.pl_minutes);
  return { rows, ok: true };
}

export function summarizeSquadKpis(rows: HealthDisplayRow[]) {
  const atRisk = rows.filter((h) => h.status !== "Available" || h.injury_risk === "Medium");
  const available = rows.filter((h) => h.status === "Available" && h.injury_risk === "Low");
  const total = rows.length || 1;
  const benchDepthScore = Math.round((available.length / total) * 70 + (1 - atRisk.length / total) * 30);
  const avgFatigue = Math.round(rows.reduce((s, h) => s + h.fatigue, 0) / total);
  const readinessPct = Math.round(rows.reduce((s, h) => s + h.readiness, 0) / total);
  const flaggedCount = rows.filter((h) => h.injury_risk !== "Low").length;
  return { atRisk, available, benchDepthScore, avgFatigue, readinessPct, flaggedCount, total };
}
