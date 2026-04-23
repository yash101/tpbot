import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type TopNavSlot = "left" | "center" | "right";

type TopNavActionsContextValue = {
  registerSlot: (slot: TopNavSlot, id: symbol, node: React.ReactNode) => void;
  unregisterSlot: (slot: TopNavSlot, id: symbol) => void;
};

type TopNavSlotsContextValue = {
  slots: Record<TopNavSlot, React.ReactNode[]>;
};

const TopNavActionsContext = React.createContext<TopNavActionsContextValue | null>(null);
const TopNavSlotsContext = React.createContext<TopNavSlotsContextValue | null>(null);

export function TopNavProvider({ children }: { children: React.ReactNode }) {
  const [slotMap, setSlotMap] = useState<Record<TopNavSlot, Map<symbol, React.ReactNode>>>(() => ({
    left: new Map(),
    center: new Map(),
    right: new Map(),
  }));

  const registerSlot = useCallback((slot: TopNavSlot, id: symbol, node: React.ReactNode) => {
    setSlotMap((current) => {
      const next = new Map(current[slot]);
      next.set(id, node);

      return {
        ...current,
        [slot]: next,
      };
    });
  }, []);

  const unregisterSlot = useCallback((slot: TopNavSlot, id: symbol) => {
    setSlotMap((current) => {
      if (!current[slot].has(id)) return current;

      const next = new Map(current[slot]);
      next.delete(id);

      return {
        ...current,
        [slot]: next,
      };
    });
  }, []);

  const actions = useMemo<TopNavActionsContextValue>(() => ({
    registerSlot,
    unregisterSlot,
  }), [registerSlot, unregisterSlot]);

  const slots = useMemo<TopNavSlotsContextValue>(() => ({
    slots: {
      left: Array.from(slotMap.left.values()),
      center: Array.from(slotMap.center.values()),
      right: Array.from(slotMap.right.values()),
    },
  }), [slotMap]);

  return (
    <TopNavActionsContext.Provider value={actions}>
      <TopNavSlotsContext.Provider value={slots}>{children}</TopNavSlotsContext.Provider>
    </TopNavActionsContext.Provider>
  );
}

function useTopNavActionsContext() {
  const context = useContext(TopNavActionsContext);
  if (!context) {
    throw new Error("TopNav components must be used within a TopNavProvider");
  }

  return context;
}

function useTopNavSlotsContext() {
  const context = useContext(TopNavSlotsContext);
  if (!context) {
    throw new Error("TopNav components must be used within a TopNavProvider");
  }

  return context;
}

function TopNavSlotRegistration({
  slot,
  children,
}: {
  slot: TopNavSlot;
  children: React.ReactNode;
}) {
  const { registerSlot, unregisterSlot } = useTopNavActionsContext();
  const registrationId = useRef(Symbol(slot));

  useEffect(() => {
    registerSlot(slot, registrationId.current, children);

    return () => {
      unregisterSlot(slot, registrationId.current);
    };
  }, [children, registerSlot, slot, unregisterSlot]);

  return null;
}

export function TopNav() {
  const { slots } = useTopNavSlotsContext();

  return (
    <header id="top-nav" className="flex w-full justify-between pt-2 pb-2 px-[1em] border-b-blue-950">
      <div className="flex items-center gap-2">{slots.left}</div>
      <div className="flex items-center justify-center gap-2">{slots.center}</div>
      <div className="flex items-center justify-end gap-2">{slots.right}</div>
    </header>
  );
}

export function TopNavLeft({ children }: { children: React.ReactNode }) {
  return <TopNavSlotRegistration slot="left">{children}</TopNavSlotRegistration>;
}

export function TopNavCenter({ children }: { children: React.ReactNode }) {
  return <TopNavSlotRegistration slot="center">{children}</TopNavSlotRegistration>;
}

export function TopNavRight({ children }: { children: React.ReactNode }) {
  return <TopNavSlotRegistration slot="right">{children}</TopNavSlotRegistration>;
}
