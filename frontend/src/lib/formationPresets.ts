/** Pitch coordinates: higher `top` = closer to opponent goal (attacking end). 11 slots. */

export type FormationId = "4231" | "433" | "352" | "541";

export const FORMATION_META: Record<
  FormationId,
  { label: string; bias: "attacking" | "defensive" | "neutral"; short: string }
> = {
  "4231": { label: "4-2-3-1", bias: "neutral", short: "Balanced block + #10" },
  "433": { label: "4-3-3", bias: "attacking", short: "Width + front three" },
  "352": { label: "3-5-2", bias: "neutral", short: "Wing-backs + twin strikers" },
  "541": { label: "5-4-1", bias: "defensive", short: "Low block + lone outlet" },
};

export const FORMATION_SLOTS: Record<FormationId, { top: number; left: number }[]> = {
  "4231": [
    { top: 86, left: 50 },
    { top: 72, left: 22 },
    { top: 74, left: 38 },
    { top: 74, left: 62 },
    { top: 72, left: 78 },
    { top: 58, left: 36 },
    { top: 58, left: 64 },
    { top: 48, left: 22 },
    { top: 46, left: 50 },
    { top: 48, left: 78 },
    { top: 36, left: 50 },
  ],
  "433": [
    { top: 86, left: 50 },
    { top: 78, left: 28 },
    { top: 78, left: 72 },
    { top: 62, left: 36 },
    { top: 62, left: 50 },
    { top: 62, left: 64 },
    { top: 48, left: 22 },
    { top: 46, left: 38 },
    { top: 46, left: 62 },
    { top: 48, left: 78 },
    { top: 32, left: 50 },
  ],
  "352": [
    { top: 84, left: 42 },
    { top: 84, left: 58 },
    { top: 68, left: 18 },
    { top: 64, left: 36 },
    { top: 64, left: 50 },
    { top: 64, left: 64 },
    { top: 68, left: 82 },
    { top: 48, left: 30 },
    { top: 46, left: 50 },
    { top: 48, left: 70 },
    { top: 30, left: 50 },
  ],
  "541": [
    { top: 88, left: 50 },
    { top: 70, left: 18 },
    { top: 68, left: 34 },
    { top: 66, left: 50 },
    { top: 68, left: 66 },
    { top: 70, left: 82 },
    { top: 52, left: 28 },
    { top: 50, left: 44 },
    { top: 50, left: 56 },
    { top: 52, left: 72 },
    { top: 30, left: 50 },
  ],
};

export function awaySlotsFromHome(home: { top: number; left: number }[]) {
  return home.map((s) => ({ top: 100 - s.top, left: s.left }));
}
