import { useState, useRef, useEffect } from "react";
import { Send, Bot, User } from "lucide-react";
import { api } from "../lib/api";

const SUGGESTED_QUERIES = [
  "Which upcoming fixtures are at risk of low attendance?",
  "Which players have declining form over the last 5 matches?",
  "Who is the best transfer target for defensive midfield?",
  "Which player is generating the highest media attention this week?",
  "How can we maximize revenue for the next home fixture?",
];

export default function Copilot() {
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
          content: "Sorry, the AI assistant is unavailable. Please check your Databricks connection.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-8rem)]">
      <div>
        <h1 className="text-3xl font-display tracking-widest text-white uppercase">
          Ask the Club Assistant
        </h1>
        <p className="text-white/60 mt-1">
          Natural language insights for sporting and commercial decisions
        </p>
      </div>

      <div className="flex-1 flex flex-col bg-surface-700 rounded-xl border border-surface-600 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              <p className="text-white/60">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_QUERIES.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => ask(q)}
                    className="px-4 py-2 rounded-lg bg-white/10 text-white/80 text-sm hover:bg-white/15 hover:text-white transition-colors"
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
              className={`flex gap-3 ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="p-2 rounded-lg bg-white/15 shrink-0">
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] p-4 rounded-xl ${
                  msg.role === "user"
                    ? "bg-white/15 text-white"
                    : "bg-white/5 text-white/90 border border-white/10"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.role === "user" && (
                <div className="p-2 rounded-lg bg-white/15 shrink-0">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="p-2 rounded-lg bg-white/15 shrink-0">
                <Bot className="w-5 h-5 text-fcb-yellow animate-pulse" />
              </div>
              <div className="p-4 rounded-xl bg-surface-800 border border-surface-600">
                <p className="text-white/60">Thinking...</p>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <div className="p-4 border-t border-white/10">
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
              placeholder="Ask about attendance, players, transfers, revenue..."
              className="flex-1 bg-white/10 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-fcb-blue/50"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-6 py-3 bg-fcb-blue text-white font-semibold rounded-lg hover:bg-fcb-blue-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
