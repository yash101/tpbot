import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

interface SettingsItem {
  id: symbol;
  element: ReactNode;
}

interface SettingsContextType {
  items: SettingsItem[],
  open: () => void,
  close: () => void,
  isOpen: boolean,
}

interface SettingsActionsContextType {
  register: (id: symbol, element: ReactNode) => void,
  unregister: (id: symbol) => void,
}

const SettingsContext = createContext<SettingsContextType | null>(null);
const SettingsActionsContext = createContext<SettingsActionsContextType | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [itemMap, setItemMap] = useState<Map<symbol, ReactNode>>(() => new Map());
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const register = useCallback((id: symbol, item: ReactNode) => {
    setItemMap((current) => {
      const existing = current.get(id);
      if (existing === item) return current;

      const next = new Map(current);
      next.set(id, item);
      return next;
    });
  }, []);

  const unregister = useCallback((id: symbol) => {
    setItemMap((current) => {
      if (!current.has(id)) return current;

      const next = new Map(current);
      next.delete(id);
      return next;
    });
  }, []);

  const items = useMemo<SettingsItem[]>(
    () => Array.from(itemMap.entries(), ([id, element]) => ({ id, element })),
    [itemMap],
  );

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  const stateValue = useMemo<SettingsContextType>(() => ({
    open,
    close,
    items,
    isOpen,
  }), [close, isOpen, items, open]);

  const actionsValue = useMemo<SettingsActionsContextType>(() => ({
    register,
    unregister,
  }), [register, unregister]);

  return (
    <SettingsActionsContext.Provider value={actionsValue}>
      <SettingsContext.Provider value={stateValue}>
        {children}
      </SettingsContext.Provider>
    </SettingsActionsContext.Provider>
  );
}

export function useSettingsItem(config: ReactNode) {
  const { register, unregister } = useSettingsActions();
  const idRef = useRef(Symbol());

  useEffect(() => {
    register(idRef.current, config);

    return () => unregister(idRef.current);
  }, [config, register, unregister]);
}

export function useStableSettingsItem(config: ReactNode) {
  const { register, unregister } = useSettingsActions();
  const idRef = useRef(Symbol());
  const configRef = useRef(config);

  useEffect(() => {
    register(idRef.current, configRef.current);

    return () => unregister(idRef.current);
  }, [register, unregister]);
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (ctx === null) throw new Error('Error: must be used inside a settings provider');

  return ctx;
}

function useSettingsActions() {
  const ctx = useContext(SettingsActionsContext);
  if (ctx === null) throw new Error('Error: must be used inside a settings provider');

  return ctx;
}
