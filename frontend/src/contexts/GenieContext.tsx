import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface GenieContextType {
  isOpen: boolean;
  openGenie: () => void;
  closeGenie: () => void;
}

const Context = createContext<GenieContextType | null>(null);

export function GenieProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const openGenie = useCallback(() => setIsOpen(true), []);
  const closeGenie = useCallback(() => setIsOpen(false), []);
  return (
    <Context.Provider value={{ isOpen, openGenie, closeGenie }}>
      {children}
    </Context.Provider>
  );
}

export function useGenie() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error("useGenie must be used within GenieProvider");
  return ctx;
}
