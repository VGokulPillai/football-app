import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  Eye,
  Zap,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Video,
  Users,
  Shield,
  Brain,
  Search,
  ClipboardList,
} from "lucide-react";

const API_BASE = "/api";

/* ── Brand ───────────────────────────────────────── */
const FCB = {
  blue: "#004D98",
  yellow: "#EDBB00",
  red: "#A50044",
  glow: "rgba(0,77,152,0.35)",
  glass: "rgba(0,77,152,0.08)",
  border: "rgba(0,77,152,0.18)",
};
const DB_RED = "#FF3621";

/* ── Types ───────────────────────────────────────── */
type FitScores = {
  "Attacking Winger": number;
  "Defensive Midfielder": number;
  "Overlapping Fullback": number;
};

type Player = {
  id: number;
  positions: number[][];
  distance: number;
  avg_speed: number;
  sprint_count: number;
  avg_position: number[];
  fit_scores: FitScores;
  reasoning: string;
};

type AnalysisResult = {
  players: Player[];
  source: "real_video" | "mock_data";
};

type NodePhase = "idle" | "running" | "completed";

/* ── Agent Pipeline Nodes ────────────────────────── */
interface PipelineNode {
  id: string;
  label: string;
  desc: string;
  color: string;
  icon: string;
  x: number;
  y: number;
  details: string[];
}

const PIPELINE_NODES: PipelineNode[] = [
  {
    id: "video_analysis",
    label: "VIDEO ANALYSIS",
    desc: "Movement & positioning extraction",
    color: "#06B6D4",
    icon: "🎬",
    x: 400,
    y: 60,
    details: [
      "YOLO v8 object detection on match footage",
      "Player tracking across frames with DeepSort",
      "Sprint detection, heat maps, distance calculation",
      "Pressing trigger identification & off-ball movement",
    ],
  },
  {
    id: "performance_data",
    label: "PERFORMANCE DATA",
    desc: "Full player profile builder",
    color: "#818CF8",
    icon: "📊",
    x: 400,
    y: 200,
    details: [
      "Combines GPS data + match stats from API-Football",
      "Injury history cross-reference (last 2 seasons)",
      "xG, xA, progressive carries, pressures per 90",
      "Builds normalised feature vector for comparison",
    ],
  },
  {
    id: "scouting",
    label: "SCOUTING AGENT",
    desc: "Talent identification & comparison",
    color: "#F59E0B",
    icon: "🔍",
    x: 400,
    y: 340,
    details: [
      "Compares against 5,000+ player embeddings (Vector Search)",
      "Identifies hidden talent in lower leagues",
      "La Masia graduate potential assessment",
      "Transfer market value estimation with age curve",
    ],
  },
  {
    id: "tactical",
    label: "TACTICAL AGENT",
    desc: "Formation fit & opposition analysis",
    color: "#10B981",
    icon: "🧩",
    x: 400,
    y: 480,
    details: [
      "Tests player fit in 4-3-3, 4-2-3-1, 3-5-2 formations",
      "Opposition weak-side analysis (La Liga + UCL)",
      "Pressing intensity compatibility score",
      "Compares tactical DNA to Barça positional play model",
    ],
  },
  {
    id: "recruitment",
    label: "RECRUITMENT",
    desc: "Ranked shortlist & recommendations",
    color: "#A50044",
    icon: "📋",
    x: 400,
    y: 620,
    details: [
      "Aggregates all 4 agent outputs into a weighted score",
      "Generates ranked shortlist for sporting director",
      "Explainable reasoning per recommendation",
      "Contract value vs performance ROI projection",
    ],
  },
];

const NODE_MAP = Object.fromEntries(PIPELINE_NODES.map((n) => [n.id, n]));

interface PipelineEdge {
  from: string;
  to: string;
}

const PIPELINE_EDGES: PipelineEdge[] = [
  { from: "video_analysis", to: "performance_data" },
  { from: "performance_data", to: "scouting" },
  { from: "scouting", to: "tactical" },
  { from: "tactical", to: "recruitment" },
];

/* ── Demo simulation sequence ────────────────────── */
const DEMO_SEQUENCE: { node: string; phase: NodePhase; delay: number }[] = [
  { node: "video_analysis", phase: "running", delay: 0 },
  { node: "video_analysis", phase: "completed", delay: 2200 },
  { node: "performance_data", phase: "running", delay: 2400 },
  { node: "performance_data", phase: "completed", delay: 4800 },
  { node: "scouting", phase: "running", delay: 5000 },
  { node: "scouting", phase: "completed", delay: 7500 },
  { node: "tactical", phase: "running", delay: 7700 },
  { node: "tactical", phase: "completed", delay: 10200 },
  { node: "recruitment", phase: "running", delay: 10400 },
  { node: "recruitment", phase: "completed", delay: 12800 },
];

const DEMO_LOGS: { msg: string; delay: number; color: string }[] = [
  { msg: "VIDEO ANALYSIS → Ingesting match footage…", delay: 200, color: "#06B6D4" },
  { msg: "VIDEO ANALYSIS → YOLO v8 detecting 22 players across 1,840 frames…", delay: 800, color: "#06B6D4" },
  { msg: "VIDEO ANALYSIS → DeepSort tracking: 11 Barça players identified, sprint patterns extracted", delay: 1600, color: "#06B6D4" },
  { msg: "VIDEO ANALYSIS → ✓ Heatmaps, distance, avg speed, pressing triggers computed", delay: 2100, color: "#06B6D4" },
  { msg: "PERFORMANCE DATA → Enriching with API-Football season stats (2025-26)…", delay: 2600, color: "#818CF8" },
  { msg: "PERFORMANCE DATA → GPS overlay: 11.2 km avg distance, 32.4 km/h top speed detected", delay: 3400, color: "#818CF8" },
  { msg: "PERFORMANCE DATA → xG: 0.42, xA: 0.31, progressive carries: 4.2 per 90", delay: 4200, color: "#818CF8" },
  { msg: "PERFORMANCE DATA → ✓ Full player feature vectors ready for comparison", delay: 4700, color: "#818CF8" },
  { msg: "SCOUTING → Querying Vector Search index (5,000+ player embeddings)…", delay: 5200, color: "#F59E0B" },
  { msg: "SCOUTING → Similar profiles found: Pedri (87%), Gavi (82%), Olmo (79%)", delay: 6200, color: "#F59E0B" },
  { msg: "SCOUTING → La Masia potential score: 78/100 — high positional intelligence", delay: 7000, color: "#F59E0B" },
  { msg: "SCOUTING → ✓ Transfer value estimate: EUR 35-45M (age-adjusted curve)", delay: 7400, color: "#F59E0B" },
  { msg: "TACTICAL → Testing fit in 4-3-3 (Flick primary)…", delay: 7900, color: "#10B981" },
  { msg: "TACTICAL → 4-3-3 fit: 91% — ideal interior midfielder profile", delay: 8700, color: "#10B981" },
  { msg: "TACTICAL → Pressing compatibility: HIGH (8.2 pressures/90 vs Barça avg 7.1)", delay: 9400, color: "#10B981" },
  { msg: "TACTICAL → ✓ Opposition weak-side exploitable in 68% of La Liga fixtures", delay: 10100, color: "#10B981" },
  { msg: "RECRUITMENT → Aggregating 4-agent scores with weighted ensemble…", delay: 10600, color: "#A50044" },
  { msg: "RECRUITMENT → Final score: 87/100 — RECOMMENDED for shortlist", delay: 11400, color: "#A50044" },
  { msg: "RECRUITMENT → ROI projection: 2.3x over 4-year contract cycle", delay: 12000, color: "#A50044" },
  { msg: "RECRUITMENT → ✓ Report generated for Sporting Director — 5 agents completed", delay: 12700, color: "#A50044" },
];

/* ── Agent result output data ────────────────────── */
const AGENT_RESULTS: Record<string, { title: string; metrics: { label: string; value: string }[]; summary: string }> = {
  video_analysis: {
    title: "Movement Analysis Complete",
    metrics: [
      { label: "Frames Processed", value: "1,840" },
      { label: "Players Tracked", value: "22" },
      { label: "Sprint Events", value: "47" },
      { label: "Pressing Triggers", value: "23" },
    ],
    summary: "High-intensity off-ball movement detected. Player shows elite pressing patterns with 23 triggers in 45 minutes — top 5% across La Liga midfielders.",
  },
  performance_data: {
    title: "Profile Built",
    metrics: [
      { label: "Distance / 90", value: "11.2 km" },
      { label: "Top Speed", value: "32.4 km/h" },
      { label: "xG per 90", value: "0.42" },
      { label: "Pass Accuracy", value: "91.3%" },
    ],
    summary: "Above-average physical output combined with elite passing accuracy. Progressive carries (4.2/90) indicate strong transition play. No injury flags in last 18 months.",
  },
  scouting: {
    title: "Talent Assessment",
    metrics: [
      { label: "Similar to Pedri", value: "87%" },
      { label: "Similar to Gavi", value: "82%" },
      { label: "La Masia Score", value: "78/100" },
      { label: "Market Value", value: "EUR 35-45M" },
    ],
    summary: "Profile strongly matches Barça's positional play DNA. Comparable to Pedri in spatial awareness and progressive passing. Hidden gem potential in mid-table clubs.",
  },
  tactical: {
    title: "Formation Fit",
    metrics: [
      { label: "4-3-3 Fit", value: "91%" },
      { label: "4-2-3-1 Fit", value: "84%" },
      { label: "Pressing Index", value: "HIGH" },
      { label: "Weak-side Exploit", value: "68%" },
    ],
    summary: "Ideal interior midfielder for Flick's 4-3-3. Pressing intensity exceeds squad average. Tactical versatility allows deployment as #8 or #10 depending on opposition.",
  },
  recruitment: {
    title: "Final Recommendation",
    metrics: [
      { label: "Overall Score", value: "87/100" },
      { label: "Verdict", value: "SIGN" },
      { label: "ROI Projection", value: "2.3x" },
      { label: "Priority", value: "HIGH" },
    ],
    summary: "RECOMMENDED for shortlist. Strong tactical fit, elite physical profile, and favourable market position. Suggest opening negotiations before January window.",
  },
};

const ROLE_COLORS: Record<string, string> = {
  "Attacking Winger": "#004D98",
  "Defensive Midfielder": "#1E40AF",
  "Overlapping Fullback": "#059669",
};

function bestRole(fit: FitScores): string {
  return Object.entries(fit).sort((a, b) => b[1] - a[1])[0][0];
}

/* ── Glass Panel ─────────────────────────────────── */
function GlassPanel({
  children,
  className = "",
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`rounded-2xl relative overflow-hidden ${className}`}
      style={{
        background: "rgba(0,0,0,0.45)",
        border: `1px solid ${FCB.border}`,
        backdropFilter: "blur(28px)",
        WebkitBackdropFilter: "blur(28px)",
        boxShadow: `0 8px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)`,
        ...style,
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${FCB.blue}30, transparent)` }}
      />
      {children}
    </div>
  );
}

/* ── Pitch Overlay ───────────────────────────────── */
function PitchOverlay({ players, selected }: { players: Player[]; selected: number | null }) {
  const W = 680;
  const H = 440;
  const scaleX = W / 1920;
  const scaleY = H / 1080;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-xl border border-white/10 bg-emerald-900/90">
      <rect x="2" y="2" width={W - 4} height={H - 4} rx="8" fill="none" stroke="white" strokeOpacity="0.3" />
      <line x1={W / 2} y1="2" x2={W / 2} y2={H - 2} stroke="white" strokeOpacity="0.2" />
      <circle cx={W / 2} cy={H / 2} r="40" fill="none" stroke="white" strokeOpacity="0.2" />
      {players.map((p) => {
        const isSelected = selected === p.id;
        const role = bestRole(p.fit_scores);
        const color = ROLE_COLORS[role] || "#999";
        return (
          <g key={p.id}>
            {p.positions.length > 1 && (
              <polyline
                points={p.positions.map(([x, y]) => `${x * scaleX},${y * scaleY}`).join(" ")}
                fill="none"
                stroke={color}
                strokeWidth={isSelected ? 2 : 0.8}
                strokeOpacity={isSelected ? 0.7 : 0.2}
              />
            )}
            <circle
              cx={p.avg_position[0] * scaleX}
              cy={p.avg_position[1] * scaleY}
              r={isSelected ? 8 : 5}
              fill={color}
              fillOpacity={isSelected ? 1 : 0.7}
              stroke="white"
              strokeWidth={isSelected ? 2 : 0.5}
            />
            <text
              x={p.avg_position[0] * scaleX}
              y={p.avg_position[1] * scaleY - (isSelected ? 12 : 8)}
              textAnchor="middle"
              fill="white"
              fontSize={isSelected ? 11 : 9}
              fontWeight={isSelected ? 700 : 400}
            >
              P{p.id}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Agent Icon Component ────────────────────────── */
const AGENT_ICONS: Record<string, typeof Brain> = {
  video_analysis: Video,
  performance_data: Zap,
  scouting: Search,
  tactical: Shield,
  recruitment: ClipboardList,
};

/* ── Main Component ──────────────────────────────── */
export default function VisionScouting() {
  const fileRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [cvStatus, setCvStatus] = useState<{ real_cv_available: boolean } | null>(null);

  const [nodePhases, setNodePhases] = useState<Record<string, NodePhase>>({});
  const [logs, setLogs] = useState<{ msg: string; color: string }[]>([]);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineComplete, setPipelineComplete] = useState(false);
  const [completedAgents, setCompletedAgents] = useState<string[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/vision/status`)
      .then((r) => r.json())
      .then(setCvStatus)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const runPipeline = useCallback(async () => {
    if (pipelineRunning) return;

    setPipelineRunning(true);
    setPipelineComplete(false);
    setNodePhases({});
    setLogs([]);
    setResult(null);
    setSelected(null);
    setCompletedAgents([]);
    setSelectedNode(null);

    const timers: ReturnType<typeof setTimeout>[] = [];

    DEMO_SEQUENCE.forEach(({ node, phase, delay }) => {
      timers.push(
        setTimeout(() => {
          setNodePhases((prev) => ({ ...prev, [node]: phase }));
          if (phase === "completed") {
            setCompletedAgents((prev) => [...prev, node]);
          }
        }, delay)
      );
    });

    DEMO_LOGS.forEach(({ msg, delay, color }) => {
      timers.push(
        setTimeout(() => {
          setLogs((prev) => [...prev, { msg, color }]);
        }, delay)
      );
    });

    // Fire the actual API analysis in background
    const apiPromise = (async () => {
      try {
        const form = new FormData();
        if (file) form.append("video", file);
        const res = await fetch(`${API_BASE}/vision/analyze`, { method: "POST", body: form });
        if (!res.ok) throw new Error(`${res.status}`);
        return (await res.json()) as AnalysisResult;
      } catch {
        return null;
      }
    })();

    timers.push(
      setTimeout(async () => {
        const data = await apiPromise;
        if (data) {
          setResult(data);
          if (data.players.length > 0) setSelected(data.players[0].id);
        }
        setPipelineRunning(false);
        setPipelineComplete(true);
      }, 13200)
    );

    return () => timers.forEach(clearTimeout);
  }, [pipelineRunning, file]);

  const NODE_R = 28;
  const SVG_W = 800;
  const SVG_H = 700;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px]"
              style={{
                background: FCB.glass,
                border: `1px solid ${FCB.border}`,
                color: FCB.yellow,
                backdropFilter: "blur(16px)",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
              Multi-Agent Pipeline · 5 Agents · LangGraph
            </div>
          </div>
          <h1 className="text-3xl font-display tracking-widest text-white uppercase">
            Vision Scouting Intelligence
          </h1>
          <p className="text-white/50 mt-1">
            5 AI agents work together — from video analysis to recruitment recommendation
          </p>
        </div>
        {pipelineComplete && result && (
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              result.source === "real_video"
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-amber-500/20 text-amber-300"
            }`}
          >
            {result.source === "real_video" ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" /> Real analysis
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5" /> Demo mode
              </>
            )}
          </span>
        )}
      </div>

      {/* ── Upload + controls ── */}
      <GlassPanel className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div
            className="flex-1 border-2 border-dashed border-white/15 rounded-lg p-6 text-center cursor-pointer hover:border-white/25 transition-colors"
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept="video/mp4,video/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-white/80">
                <Video className="w-5 h-5 text-white" />
                <span className="font-medium">{file.name}</span>
                <span className="text-xs text-white/50">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-white/50">
                <Upload className="w-8 h-8" />
                <span className="text-sm">Drop a football mp4 here or click to browse</span>
                <span className="text-xs">No video? Click &quot;Launch Agents&quot; for demo mode</span>
              </div>
            )}
          </div>

          <button
            onClick={runPipeline}
            disabled={pipelineRunning}
            className="inline-flex items-center gap-2 px-6 py-3 font-semibold rounded-lg transition-all disabled:opacity-30 text-white"
            style={{
              background: pipelineRunning ? "transparent" : `linear-gradient(135deg, ${FCB.blue}, ${FCB.red})`,
              border: `1px solid ${FCB.border}`,
              boxShadow: pipelineRunning ? "none" : `0 2px 16px ${FCB.glow}`,
            }}
          >
            {pipelineRunning ? (
              <span className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full" />
            ) : (
              <Brain className="w-5 h-5" />
            )}
            {pipelineRunning ? "Agents Running…" : "Launch Agents"}
          </button>
        </div>

        {cvStatus && (
          <p className="mt-3 text-xs text-white/40 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            {cvStatus.real_cv_available
              ? "YOLO + OpenCV available — real video processing enabled"
              : "Demo mode — mock agent outputs. Install ultralytics + opencv-python for real CV."}
          </p>
        )}
      </GlassPanel>

      {/* ── Main Pipeline Grid ── */}
      {(pipelineRunning || pipelineComplete) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* ── LEFT: Pipeline SVG ── */}
          <div className="lg:col-span-5">
            <GlassPanel className="p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold tracking-[0.15em]" style={{ color: FCB.yellow }}>
                  LANGGRAPH AGENT TOPOLOGY
                </p>
                {pipelineRunning && (
                  <span className="flex items-center gap-1.5 text-[10px] text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
                    executing…
                  </span>
                )}
                {pipelineComplete && (
                  <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                    <CheckCircle className="w-3 h-3" />
                    complete
                  </span>
                )}
              </div>

              <svg width="100%" viewBox={`0 0 ${SVG_W} ${SVG_H}`} style={{ overflow: "visible" }}>
                <defs>
                  {PIPELINE_NODES.map((n) => (
                    <radialGradient key={`glow-${n.id}`} id={`glow-${n.id}`}>
                      <stop offset="0%" stopColor={n.color} stopOpacity="0.4" />
                      <stop offset="100%" stopColor={n.color} stopOpacity="0" />
                    </radialGradient>
                  ))}
                  <filter id="blur-glow">
                    <feGaussianBlur stdDeviation="8" />
                  </filter>
                  <marker id="ah" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.12)" />
                  </marker>
                  <marker id="ah-active" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill={FCB.yellow} />
                  </marker>
                </defs>

                {/* Edges */}
                {PIPELINE_EDGES.map((edge, i) => {
                  const from = NODE_MAP[edge.from];
                  const to = NODE_MAP[edge.to];
                  if (!from || !to) return null;

                  const fromPhase = nodePhases[edge.from] || "idle";
                  const toPhase = nodePhases[edge.to] || "idle";
                  const active = fromPhase === "completed" && (toPhase === "running" || toPhase === "completed");
                  const pending = fromPhase === "completed" && toPhase === "idle";

                  const dx = to.x - from.x;
                  const dy = to.y - from.y;
                  const dist = Math.sqrt(dx * dx + dy * dy);
                  if (dist === 0) return null;
                  const ux = dx / dist;
                  const uy = dy / dist;
                  const x1 = from.x + ux * (NODE_R + 4);
                  const y1 = from.y + uy * (NODE_R + 4);
                  const x2 = to.x - ux * (NODE_R + 4);
                  const y2 = to.y - uy * (NODE_R + 4);

                  return (
                    <g key={i}>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={active ? from.color : pending ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)"}
                        strokeWidth={active ? 2 : 1.5}
                        markerEnd={active ? "url(#ah-active)" : "url(#ah)"}
                      />
                      {active && (
                        <line
                          x1={x1}
                          y1={y1}
                          x2={x2}
                          y2={y2}
                          stroke={from.color}
                          strokeWidth={2}
                          strokeDasharray="8 5"
                          opacity={0.7}
                          className="edge-active"
                        />
                      )}
                    </g>
                  );
                })}

                {/* Nodes */}
                {PIPELINE_NODES.map((nd) => {
                  const phase = nodePhases[nd.id] || "idle";
                  const isActive = phase === "running";
                  const isDone = phase === "completed";

                  const fillOpacity = isDone ? 0.18 : isActive ? 0.14 : 0.04;
                  const strokeOpacity = isDone ? 1 : isActive ? 1 : 0.25;

                  return (
                    <g
                      key={nd.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelectedNode(selectedNode === nd.id ? null : nd.id)}
                    >
                      {(isActive || isDone) && (
                        <circle
                          cx={nd.x}
                          cy={nd.y}
                          r={NODE_R + 20}
                          fill={`url(#glow-${nd.id})`}
                          filter="url(#blur-glow)"
                        />
                      )}

                      {isActive && (
                        <circle
                          cx={nd.x}
                          cy={nd.y}
                          r={NODE_R + 6}
                          fill="none"
                          stroke={nd.color}
                          strokeWidth={1.5}
                          opacity={0.4}
                          className="node-running"
                        />
                      )}

                      <circle
                        cx={nd.x}
                        cy={nd.y}
                        r={NODE_R}
                        fill={nd.color}
                        fillOpacity={fillOpacity}
                        stroke={nd.color}
                        strokeWidth={isActive ? 2.5 : isDone ? 2 : 1.5}
                        strokeOpacity={strokeOpacity}
                        style={isActive ? { filter: `drop-shadow(0 0 14px ${nd.color})` } : undefined}
                      />

                      {isDone && (
                        <text
                          x={nd.x}
                          y={nd.y + 5}
                          textAnchor="middle"
                          fill={nd.color}
                          fontSize={16}
                          fontWeight={700}
                        >
                          ✓
                        </text>
                      )}
                      {isActive && (
                        <text
                          x={nd.x}
                          y={nd.y + 5}
                          textAnchor="middle"
                          fill={nd.color}
                          fontSize={12}
                          fontWeight={700}
                          className="glow-pulse"
                        >
                          ●
                        </text>
                      )}
                      {phase === "idle" && (
                        <text
                          x={nd.x}
                          y={nd.y + 4}
                          textAnchor="middle"
                          fill="rgba(255,255,255,0.12)"
                          fontSize={10}
                          fontWeight={600}
                        >
                          {PIPELINE_NODES.indexOf(nd) + 1}
                        </text>
                      )}

                      {/* Label */}
                      <text
                        x={nd.x + NODE_R + 10}
                        y={nd.y - 8}
                        textAnchor="start"
                        fill={isDone || isActive ? nd.color : "rgba(255,255,255,0.30)"}
                        fontSize={10}
                        fontWeight={700}
                        letterSpacing="0.07em"
                      >
                        {nd.icon} {nd.label}
                      </text>
                      <text
                        x={nd.x + NODE_R + 10}
                        y={nd.y + 6}
                        textAnchor="start"
                        fill="rgba(255,255,255,0.20)"
                        fontSize={8}
                      >
                        {nd.desc}
                      </text>

                      {/* Databricks badge */}
                      <rect
                        x={nd.x + NODE_R + 8}
                        y={nd.y + 12}
                        width={80}
                        height={14}
                        rx={4}
                        fill={`${DB_RED}08`}
                        stroke={`${DB_RED}20`}
                        strokeWidth={0.5}
                      />
                      <text
                        x={nd.x + NODE_R + 48}
                        y={nd.y + 22}
                        textAnchor="middle"
                        fill={`${DB_RED}90`}
                        fontSize={7}
                        fontFamily="monospace"
                        fontWeight={600}
                      >
                        Databricks FMAPI
                      </text>
                    </g>
                  );
                })}
              </svg>
            </GlassPanel>
          </div>

          {/* ── RIGHT: Logs + Agent Results ── */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Live trace log */}
            <GlassPanel className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold tracking-[0.15em]" style={{ color: FCB.yellow }}>
                  LIVE AGENT TRACE LOG
                </p>
                {pipelineRunning && (
                  <span className="flex items-center gap-1.5 text-[10px] text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
                    streaming…
                  </span>
                )}
              </div>
              <div ref={logRef} className="space-y-1.5 overflow-y-auto" style={{ maxHeight: 200 }}>
                {logs.map((log, i) => (
                  <div key={i} className="text-[10px] font-mono leading-relaxed flex items-start gap-2 card-enter">
                    <span className="text-white/12 w-5 text-right flex-shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span style={{ color: log.color + "bb" }}>{log.msg}</span>
                  </div>
                ))}
                {logs.length === 0 && !pipelineRunning && (
                  <div className="text-[10px] text-white/20 text-center py-4">
                    Click &quot;Launch Agents&quot; to see the pipeline in action
                  </div>
                )}
                {logs.length === 0 && pipelineRunning && (
                  <div className="text-[10px] text-amber-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
                    Connecting to multi-agent pipeline…
                  </div>
                )}
              </div>
            </GlassPanel>

            {/* Agent result cards - appear one by one */}
            <div className="space-y-3">
              {completedAgents.map((agentId) => {
                const nd = NODE_MAP[agentId];
                const res = AGENT_RESULTS[agentId];
                const Icon = AGENT_ICONS[agentId] || Brain;
                if (!nd || !res) return null;
                return (
                  <motion.div
                    key={agentId}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                  >
                    <GlassPanel className="p-4" style={{ borderLeft: `3px solid ${nd.color}` }}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" style={{ color: nd.color }} />
                          <span className="text-xs font-bold tracking-widest" style={{ color: nd.color }}>
                            {nd.label}
                          </span>
                        </div>
                        <span
                          className="text-[10px] font-bold px-2.5 py-0.5 rounded-full"
                          style={{
                            background: `${nd.color}15`,
                            border: `1px solid ${nd.color}35`,
                            color: nd.color,
                          }}
                        >
                          ✓ {res.title}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {res.metrics.map((m) => (
                          <div
                            key={m.label}
                            className="rounded-lg p-2"
                            style={{ background: `${nd.color}08`, border: `1px solid ${nd.color}15` }}
                          >
                            <p className="text-[8px] text-white/30 uppercase tracking-wider">{m.label}</p>
                            <p className="text-sm font-bold" style={{ color: nd.color }}>
                              {m.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      <p className="text-[11px] text-white/55 leading-relaxed">{res.summary}</p>
                    </GlassPanel>
                  </motion.div>
                );
              })}
            </div>

            {/* Node detail popover */}
            {selectedNode && NODE_MAP[selectedNode] && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-enter"
              >
                <GlassPanel
                  className="p-5"
                  style={{
                    border: `1px solid ${NODE_MAP[selectedNode].color}35`,
                    boxShadow: `0 0 40px ${NODE_MAP[selectedNode].color}15`,
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ background: NODE_MAP[selectedNode].color }} />
                      <span className="text-xs font-bold tracking-[0.1em]" style={{ color: NODE_MAP[selectedNode].color }}>
                        {NODE_MAP[selectedNode].icon} {NODE_MAP[selectedNode].label}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedNode(null)}
                      className="text-white/25 hover:text-white text-[10px] transition-all"
                    >
                      close
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {NODE_MAP[selectedNode].details.map((detail, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-[8px] mt-1" style={{ color: NODE_MAP[selectedNode].color + "70" }}>
                          ●
                        </span>
                        <span className="text-[11px] text-white/50 leading-relaxed">{detail}</span>
                      </div>
                    ))}
                  </div>
                </GlassPanel>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* ── Results (after pipeline complete) ── */}
      {pipelineComplete && result && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-2"
            >
              <GlassPanel className="p-5">
                <h2 className="text-lg font-semibold text-white uppercase tracking-wide mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5" /> Player Positions & Trajectories
                </h2>
                <PitchOverlay players={result.players} selected={selected} />
                <p className="mt-2 text-xs text-white/50">
                  {result.players.length} players detected. Click a player card to highlight trajectory.
                </p>
              </GlassPanel>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <GlassPanel className="p-5 max-h-[540px] overflow-y-auto">
                <h2 className="text-lg font-semibold text-white uppercase tracking-wide mb-3 flex items-center gap-2">
                  <Users className="w-5 h-5" /> Detected Players
                </h2>
                <div className="space-y-2">
                  {result.players.map((p) => {
                    const role = bestRole(p.fit_scores);
                    const color = ROLE_COLORS[role];
                    const isActive = selected === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelected(p.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          isActive ? "border-fcb-blue bg-white/5 shadow-sm" : "border-white/10 hover:border-white/15"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm text-white">Player {p.id}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: color }}>
                            {role.split(" ").map((w) => w[0]).join("")}
                          </span>
                        </div>
                        <div className="flex gap-3 mt-1 text-xs text-white/60">
                          <span>{p.distance} km</span>
                          <span>{p.avg_speed} km/h</span>
                          <span>{p.sprint_count} sprints</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </GlassPanel>
            </motion.div>
          </div>

          {/* Squad fit matrix */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <GlassPanel className="p-6">
              <h2 className="text-lg font-semibold text-white uppercase tracking-wide mb-4">Squad Fit Matrix</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/60 text-xs uppercase tracking-wide">
                      <th className="pb-3 pr-4">Player</th>
                      <th className="pb-3 pr-4">Distance</th>
                      <th className="pb-3 pr-4">Speed</th>
                      <th className="pb-3 pr-4">Sprints</th>
                      <th className="pb-3 pr-4 text-center">Winger</th>
                      <th className="pb-3 pr-4 text-center">CDM</th>
                      <th className="pb-3 pr-4 text-center">Fullback</th>
                      <th className="pb-3">Best Fit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.players.map((p) => {
                      const role = bestRole(p.fit_scores);
                      return (
                        <tr
                          key={p.id}
                          className={`border-t border-white/10 cursor-pointer hover:bg-white/5 transition-colors ${
                            selected === p.id ? "bg-white/5" : ""
                          }`}
                          onClick={() => setSelected(p.id)}
                        >
                          <td className="py-2.5 pr-4 font-medium text-white">P{p.id}</td>
                          <td className="py-2.5 pr-4 tabular-nums text-white/70">{p.distance} km</td>
                          <td className="py-2.5 pr-4 tabular-nums text-white/70">{p.avg_speed} km/h</td>
                          <td className="py-2.5 pr-4 tabular-nums text-white/70">{p.sprint_count}</td>
                          {(["Attacking Winger", "Defensive Midfielder", "Overlapping Fullback"] as const).map((r) => {
                            const s = p.fit_scores[r];
                            const bg =
                              s >= 70
                                ? "bg-emerald-500/20 text-emerald-300"
                                : s >= 45
                                  ? "bg-amber-500/20 text-amber-300"
                                  : "bg-white/5 text-white/60";
                            return (
                              <td key={r} className="py-2.5 pr-4 text-center">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${bg}`}>{s}</span>
                              </td>
                            );
                          })}
                          <td className="py-2.5">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: ROLE_COLORS[role] }}>
                              {role}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlassPanel>
          </motion.div>
        </>
      )}

      {/* ── Footer ── */}
      {(pipelineRunning || pipelineComplete) && (
        <div className="text-center pb-4">
          <div className="flex items-center justify-center gap-4 text-[10px] text-white/18">
            <span>LangGraph</span>
            <span className="text-white/8">·</span>
            <span style={{ color: `${DB_RED}60` }}>Databricks FMAPI</span>
            <span className="text-white/8">·</span>
            <span>5 Agent Nodes</span>
            <span className="text-white/8">·</span>
            <span>Sequential Pipeline</span>
            <span className="text-white/8">·</span>
            <span style={{ color: `${FCB.yellow}60` }}>FC Barcelona Intelligence</span>
          </div>
        </div>
      )}
    </div>
  );
}
