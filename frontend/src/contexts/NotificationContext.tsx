import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle, Info, X } from "lucide-react";

export type NotificationType = "info" | "success" | "warning" | "error";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
}

interface NotificationContextType {
  notify: (n: Omit<Notification, "id">) => void;
  dismiss: (id: string) => void;
}

const Context = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const dismiss = useCallback((id: string) => {
    setNotifications((n) => n.filter((x) => x.id !== id));
  }, []);

  const notify = useCallback((n: Omit<Notification, "id">) => {
    const id = `n-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const duration = n.duration ?? 5000;
    setNotifications((prev) => [...prev, { ...n, id }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
  }, [dismiss]);

  return (
    <Context.Provider value={{ notify, dismiss }}>
      {children}
      <div className="fixed top-20 right-6 z-[60] flex flex-col gap-2 max-w-sm">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
              className="flex items-start gap-3 p-4 rounded-xl bg-white/[0.15] backdrop-blur-xl shadow-xl border-2 border-surface-200"
            >
              {n.type === "success" && <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />}
              {n.type === "warning" && <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />}
              {n.type === "error" && <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />}
              {n.type === "info" && <Info className="w-5 h-5 text-fcb-yellow shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-surface-900 text-sm">{n.title}</p>
                {n.message && <p className="text-sm text-surface-600 mt-0.5">{n.message}</p>}
              </div>
              <button
                onClick={() => dismiss(n.id)}
                className="p-1 rounded hover:bg-surface-100 text-surface-500"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Context.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
