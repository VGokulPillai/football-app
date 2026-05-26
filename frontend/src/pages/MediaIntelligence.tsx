import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { TrendingUp, TrendingDown, Minus, Newspaper, ExternalLink, Clock, ArrowRightLeft, Trophy, AlertTriangle, UserPlus, UserMinus, Brain } from "lucide-react";
import crestImg from "../assets/fcb-crest.png";

export default function MediaIntelligence() {
  const [sentiment, setSentiment] = useState<Array<Record<string, unknown>>>([]);
  const [trending, setTrending] = useState<Array<Record<string, unknown>>>([]);
  const [news, setNews] = useState<Array<Record<string, unknown>>>([]);
  const [transferNews, setTransferNews] = useState<Array<Record<string, unknown>>>([]);
  const [matchReports, setMatchReports] = useState<Array<Record<string, unknown>>>([]);
  const [newsInsights, setNewsInsights] = useState<{
    injuries?: Array<Record<string, unknown>>;
    transfers_in?: Array<Record<string, unknown>>;
    transfers_out?: Array<Record<string, unknown>>;
    summary?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.media.sentiment().catch((e) => { setError(String(e)); return []; }),
      api.media.trending().catch(() => []),
      api.media.news().catch(() => []),
      api.media.transferNews().catch(() => ({ articles: [] })),
      api.media.matchReports().catch(() => ({ articles: [] })),
      api.media.newsInsights().catch(() => null),
    ]).then(([s, t, n, tn, mr, ni]) => {
      setSentiment(s as Array<Record<string, unknown>>);
      setTrending(t as Array<Record<string, unknown>>);
      setNews(n as Array<Record<string, unknown>>);
      setTransferNews((tn as { articles?: Array<Record<string, unknown>> })?.articles ?? []);
      setMatchReports((mr as { articles?: Array<Record<string, unknown>> })?.articles ?? []);
      setNewsInsights(ni);
      setLoading(false);
    });
  }, []);

  const MomentumIcon = ({ m }: { m: string }) =>
    m === "rising" ? (
      <TrendingUp className="w-4 h-4 text-emerald-500" />
    ) : m === "declining" ? (
      <TrendingDown className="w-4 h-4 text-rose-500" />
    ) : (
      <Minus className="w-4 h-4 text-white/50" />
    );

  const formatDate = (d: string) => {
    if (!d) return "";
    const dt = new Date(d);
    const now = new Date();
    const diff = now.getTime() - dt.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-6">
        <img src={crestImg} alt="FC Barcelona" className="h-16 w-16 object-contain shrink-0 hidden sm:block" />
        <div>
          <h1 className="text-3xl font-display tracking-widest text-white uppercase">
            Media & Popularity Intelligence
          </h1>
          <p className="text-white/60 mt-1">
            Sentiment analysis, GPT-extracted insights (injuries, transfers), scraped news from fcbarcelona.com
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
          Some data may be unavailable. Showing cached or fallback content.
        </div>
      )}

      {/* GPT News Insights - injuries, transfers in/out from news */}
      {newsInsights && ((newsInsights.injuries?.length ?? 0) > 0 || (newsInsights.transfers_in?.length ?? 0) > 0 || (newsInsights.transfers_out?.length ?? 0) > 0 || newsInsights.summary) && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass"
        >
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5" />
            GPT News Insights
          </h2>
          <p className="text-sm text-white/60 mb-4">Extracted from fcbarcelona.com news (injuries, transfers in/out)</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(newsInsights.injuries?.length ?? 0) > 0 && (
              <div className="p-4 rounded-lg bg-white/10 border border-white/10">
                <h3 className="font-medium text-white flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Injuries in News
                </h3>
                <ul className="space-y-1 text-sm text-white/80">
                  {(newsInsights.injuries ?? []).map((i, idx) => (
                    <li key={idx}>
                      <strong>{String(i.player ?? "?")}</strong>: {String(i.reason ?? "")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(newsInsights.transfers_in?.length ?? 0) > 0 && (
              <div className="p-4 rounded-lg bg-white/10 border border-white/10">
                <h3 className="font-medium text-white flex items-center gap-2 mb-2">
                  <UserPlus className="w-4 h-4 text-emerald-500" />
                  Transfers In
                </h3>
                <ul className="space-y-1 text-sm text-white/80">
                  {(newsInsights.transfers_in ?? []).map((t, idx) => (
                    <li key={idx}>
                      <strong>{String(t.player ?? "?")}</strong> from {String(t.from_club ?? "?")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(newsInsights.transfers_out?.length ?? 0) > 0 && (
              <div className="p-4 rounded-lg bg-white/10 border border-white/10">
                <h3 className="font-medium text-white flex items-center gap-2 mb-2">
                  <UserMinus className="w-4 h-4 text-rose-500" />
                  Transfers Out
                </h3>
                <ul className="space-y-1 text-sm text-white/80">
                  {(newsInsights.transfers_out ?? []).map((t, idx) => (
                    <li key={idx}>
                      <strong>{String(t.player ?? "?")}</strong> to {String(t.to_club ?? "?")}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {newsInsights.summary && (
            <p className="mt-4 text-sm text-white/80 p-3 rounded-lg bg-white/[0.10] backdrop-blur-xl border border-white/10">
              {newsInsights.summary}
            </p>
          )}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
          <h2 className="text-lg font-semibold text-white mb-4 uppercase tracking-wide">Player Sentiment</h2>
          <div className="space-y-4">
            {loading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-white/5 rounded-lg" />
                ))}
              </div>
            ) : (
              sentiment.map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between hover:border-white/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <MomentumIcon m={String(s.popularity_momentum ?? "")} />
                    <div>
                      <p className="font-medium text-white">{String(s.player_name)}</p>
                      <p className="text-sm text-white/60">
                        Score: {Number(s.sentiment_score ?? 0).toFixed(1)} | Brand: EUR 
                        {Number(s.brand_value_estimate ?? 0).toFixed(0)}M
                      </p>
                    </div>
                  </div>
                  <span className="text-white font-semibold">
                    {Number(s.media_mentions_7d ?? 0)} mentions
                  </span>
                </motion.div>
              ))
            )}
          </div>
        </div>

        <div className="glass-card !rounded-xl p-6 border border-white/[0.12] shadow-glass">
          <h2 className="text-lg font-semibold text-white mb-4 uppercase tracking-wide">Trending This Week</h2>
          <div className="space-y-4">
            {loading ? (
              <div className="animate-pulse space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-white/5 rounded-lg" />
                ))}
              </div>
            ) : (
              trending.map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <p className="font-medium text-white">{String(t.player_name)}</p>
                    <span className="text-white font-semibold">
                      {Number(t.media_mentions_7d ?? 0)} mentions
                    </span>
                  </div>
                  <p className="text-sm text-white/60 mt-1">
                    Sentiment: {Number(t.sentiment_score ?? 0).toFixed(1)} | Momentum:{" "}
                    <span className="capitalize">{String(t.popularity_momentum)}</span>
                  </p>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Transfer News & Match Reports - Scraped from fcbarcelona.com */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card-light p-6 border-2 border-white/15 shadow-card"
        >
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <ArrowRightLeft className="w-5 h-5" />
            Latest Transfer News
          </h2>
          <p className="text-sm text-white/60 mb-4">From FC Barcelona&apos;s official channels (fcbarcelona.com)</p>
          {transferNews.length === 0 ? (
            <p className="text-white/50 text-sm">No transfer-specific news in the latest feed. Check general news below.</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {transferNews.map((a, i) => (
                <a
                  key={i}
                  href={String(a.url ?? "#")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                >
                  <p className="font-medium text-white text-sm">{String(a.headline)}</p>
                  <p className="text-xs text-white/60 mt-1 line-clamp-2">{String(a.excerpt ?? "")}</p>
                </a>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card-light p-6 border-2 border-white/15 shadow-card"
        >
          <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5" />
            Recent Match Reports
          </h2>
          <p className="text-sm text-white/60 mb-4">Official match reports from fcbarcelona.com</p>
          {matchReports.length === 0 ? (
            <p className="text-white/50 text-sm">No match reports in the latest feed. Check general news below.</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {matchReports.map((a, i) => (
                <a
                  key={i}
                  href={String(a.url ?? "#")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                >
                  <p className="font-medium text-white text-sm">{String(a.headline)}</p>
                  <p className="text-xs text-white/60 mt-1 line-clamp-2">{String(a.excerpt ?? "")}</p>
                </a>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* News & Transfer Rumors - Super section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white/[0.06] backdrop-blur-xl rounded-2xl p-8 border-2 border-white/20 shadow-xl"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-white/10">
            <Newspaper className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white uppercase tracking-wider">
              News & Transfer Rumors
            </h2>
            <p className="text-sm text-white/60">Latest from fcbarcelona.com and club sources</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-40 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-12 text-white/50">
            <Newspaper className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No news items available at the moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {news.map((n, i) => (
              <motion.a
                key={i}
                href={String(n.url ?? "#")}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="group block p-5 rounded-xl bg-white/[0.08] backdrop-blur-xl border border-white/10 hover:border-white/25 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${
                      n.sentiment === "positive"
                        ? "bg-emerald-500"
                        : n.sentiment === "negative"
                        ? "bg-rose-500"
                        : "bg-surface-400"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white group-hover:text-fcb-yellow transition-colors line-clamp-2">
                      {String(n.headline)}
                    </p>
                    {n.excerpt != null && String(n.excerpt).trim() !== "" ? (
                      <p className="text-sm text-white/60 mt-2 line-clamp-2">
                        {String(n.excerpt)}
                      </p>
                    ) : null}
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-white/50 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(String(n.date ?? ""))}
                      </span>
                      <span className="text-xs font-medium text-white flex items-center gap-1">
                        {String(n.source)}
                        <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                      </span>
                    </div>
                  </div>
                </div>
              </motion.a>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
