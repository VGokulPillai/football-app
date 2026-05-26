import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import crestImg from "../assets/fcb-crest.png";
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  Heart,
  ArrowRightLeft,
  Newspaper,
  Sliders,
  Activity,
  Sparkles,
  Globe,
  Eye,
} from "lucide-react";
import GeniePanel from "./GeniePanel";
import { useGenie } from "../contexts/GenieContext";

const navItems = [
  { path: "/", label: "Executive Dashboard", icon: LayoutDashboard },
  { path: "/football", label: "Live Football Data", icon: Globe },
  { path: "/audience", label: "Audience & Demand", icon: Users },
  { path: "/revenue", label: "Revenue Optimization", icon: TrendingUp },
  { path: "/players", label: "Player Performance", icon: Activity },
  { path: "/health", label: "Health & Readiness", icon: Heart },
  { path: "/transfers", label: "Transfer Intelligence", icon: ArrowRightLeft },
  { path: "/media", label: "Media & Sentiment", icon: Newspaper },
  { path: "/simulation", label: "Live match planning", icon: Sliders },
  { path: "/vision-scouting", label: "Vision Scouting", icon: Eye },
];

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { isOpen: genieOpen, openGenie, closeGenie } = useGenie();

  return (
    <div className="min-h-screen flex relative isolate overflow-hidden">
      {/* Full-viewport Camp Nou sunset */}
      <div
        className="fixed inset-0 z-0 pointer-events-none animate-ken-burns"
        style={{
          backgroundImage: "url(/images/camp-nou-sunset.png)",
          backgroundSize: "cover",
          backgroundPosition: "center 42%",
          backgroundRepeat: "no-repeat",
        }}
        aria-hidden
      />
      {/* Dark gradient overlay - lets the image breathe while keeping text readable */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 120% 80% at 50% 10%, rgba(0, 77, 152, 0.25) 0%, transparent 60%),
            linear-gradient(180deg,
              rgba(5, 5, 15, 0.65) 0%,
              rgba(5, 5, 15, 0.40) 15%,
              rgba(10, 10, 20, 0.30) 40%,
              rgba(10, 10, 20, 0.50) 70%,
              rgba(5, 5, 15, 0.75) 100%)
          `,
        }}
        aria-hidden
      />

      {/* Sidebar - frosted glass */}
      <aside className="relative z-10 w-64 flex flex-col border-r border-white/15 bg-black/40 backdrop-blur-2xl">
        <div className="p-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-xs text-fcb-yellow/90">
            <img
              src="/images/databricks-logo.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 object-contain rounded"
            />
            <span className="font-medium leading-tight">Powered by Databricks</span>
          </div>
        </div>
        <div className="p-6 border-b border-white/10">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={crestImg}
              alt="FC Barcelona"
              className="h-16 w-16 object-contain drop-shadow-lg flex-shrink-0 ring-2 ring-white/20 rounded-full"
            />
            <div>
              <h1 className="font-display text-lg tracking-widest text-white uppercase">
                FC Barcelona
              </h1>
              <p className="text-xs mt-0.5 text-fcb-yellow/90">Football Intelligence Platform</p>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 ${
                  isActive
                    ? "text-white font-semibold bg-white/15 backdrop-blur-sm border border-white/20 shadow-glass-sm"
                    : "text-white/80 border border-transparent hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-sm">{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content area */}
      <main className="relative z-10 flex-1 overflow-auto flex flex-col">
        {/* Top bar - glass */}
        <div className="sticky top-0 z-40 flex items-center justify-between px-8 py-3 bg-black/30 backdrop-blur-2xl border-b border-white/10">
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline font-fcb-bebas text-lg md:text-xl tracking-[0.14em] text-white/90 uppercase leading-none">
              Football Intelligence Platform
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/50">
              {new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
            </span>
            <button
              onClick={openGenie}
              className="inline-flex items-center gap-2 px-5 py-2 bg-white/15 backdrop-blur-sm text-white font-semibold rounded-lg border border-white/20 hover:bg-white/25 hover:border-white/30 hover:shadow-glass transition-all duration-200"
            >
              <Sparkles className="w-4 h-4" />
              Ask Genie
            </button>
          </div>
        </div>
        <div className="flex-1 p-8 min-h-0 relative z-10">{children}</div>
        <AnimatePresence>
          {genieOpen && (
            <GeniePanel onClose={closeGenie} />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
