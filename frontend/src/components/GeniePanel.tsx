import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Send, Bot, User, X, Sparkles } from "lucide-react";
import { api } from "../lib/api";

const SUGGESTED_QUERIES = [
  "What's the latest transfer news from fcbarcelona.com?",
  "What do recent match reports say about Lamine Yamal?",
  "Which upcoming fixtures are at risk of low attendance?",
  "Who are our top performers this season?",
  "Compare Pedri vs Gavi stats",
  "How can we maximize revenue for the next home fixture?",
];

interface GeniePanelProps {
  onClose: () => void;
}

export default function GeniePanel({ onClose }: GeniePanelProps) {
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const ask = async (query: string) => {
    if (!query.trim() || loading) return;
    const userMsg = query.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await api.copilot.ask(userMsg);
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.answer || "No response." },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "Sorry, Genie is unavailable. Please check your Databricks connection.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
      />
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed top-0 right-0 w-full max-w-lg h-full bg-black/60 backdrop-blur-2xl shadow-2xl z-50 flex flex-col border-l border-white/10"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-fcb-yellow/20">
              <Sparkles className="w-6 h-6 text-fcb-yellow" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold tracking-wide text-white">Ask Genie</h2>
              <p className="text-xs text-white/60">AI-powered club intelligence</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/70 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="space-y-4">
                <p className="text-white/60 text-sm">Ask anything about the club:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_QUERIES.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => ask(q)}
                      className="px-4 py-2 rounded-lg bg-white/8 border border-white/10 text-white/80 text-sm hover:border-white/25 hover:bg-white/12 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="p-2 rounded-lg bg-fcb-yellow/10 shrink-0">
                    <Bot className="w-5 h-5 text-fcb-yellow" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] p-5 rounded-xl ${
                    msg.role === "user"
                      ? "bg-fcb-blue/60 backdrop-blur-sm text-white border border-fcb-blue/30"
                      : "bg-white/10 backdrop-blur-sm text-white border border-white/10 shadow-glass-sm"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  ) : (
                    <div className="genie-response prose prose-sm prose-invert max-w-none prose-headings:text-fcb-yellow prose-headings:font-semibold prose-h2:text-base prose-h2:mt-4 prose-h2:mb-2 prose-h3:text-sm prose-h3:mt-3 prose-p:text-white/80 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-strong:text-fcb-yellow prose-strong:font-semibold">
                      <ReactMarkdown
                        components={{
                          h2: ({ children }) => <h2 className="text-fcb-yellow font-semibold text-base mt-4 mb-2 pb-1 border-b border-white/10">{children}</h2>,
                          h3: ({ children }) => <h3 className="text-white font-medium text-sm mt-3 mb-1">{children}</h3>,
                          ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2 text-white/80">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2 text-white/80">{children}</ol>,
                          li: ({ children }) => <li className="text-sm">{children}</li>,
                          p: ({ children }) => <p className="my-2 text-sm text-white/80 leading-relaxed">{children}</p>,
                          strong: ({ children }) => <strong className="text-fcb-yellow font-semibold">{children}</strong>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="p-2 rounded-lg bg-white/10 shrink-0">
                    <User className="w-5 h-5 text-white/80" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3">
                <div className="p-2 rounded-lg bg-fcb-yellow/10 shrink-0">
                  <Bot className="w-5 h-5 text-fcb-yellow animate-pulse" />
                </div>
                <div className="p-4 rounded-xl bg-white/10 border border-white/10">
                  <p className="text-white/50 text-sm">Thinking...</p>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          <div className="p-4 border-t border-white/10 bg-white/5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
              className="flex gap-3"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about players, fixtures, transfers..."
                className="flex-1 bg-white/10 border border-white/15 rounded-lg px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-fcb-yellow/30 focus:border-white/25 text-sm backdrop-blur-sm"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="px-5 py-3 bg-white/15 text-white font-semibold rounded-lg hover:bg-white/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 border border-white/15"
              >
                <Send className="w-4 h-4" />
                Send
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </>
  );
}
