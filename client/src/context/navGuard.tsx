"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import ConfirmDialog from "@/components/ui/ConfirmDialog";

type Guard = { message: string; onConfirm: () => void } | null;

const NavGuardContext = createContext<{ setGuard: (g: Guard) => void } | null>(null);

// Pages (e.g. an in-progress game) call setGuard(...) to require confirmation before
// the user navigates away, and setGuard(null) to release it.
export function useNavGuard() {
  return useContext(NavGuardContext) ?? { setGuard: () => {} };
}

export default function NavGuardProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [guard, setGuardState] = useState<Guard>(null);
  const [pending, setPending] = useState<string | null>(null);
  const guardRef = useRef<Guard>(null);
  guardRef.current = guard;

  const setGuard = useCallback((g: Guard) => setGuardState(g), []);

  // While a guard is active, intercept clicks on internal links anywhere on the page
  // (nav bar, logo, in-page links) and ask for confirmation first.
  useEffect(() => {
    if (!guard) return;
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        href.startsWith("http") ||
        href.startsWith("mailto:") ||
        a.target === "_blank" ||
        a.hasAttribute("download")
      ) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      setPending(href);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [guard]);

  const value = useMemo(() => ({ setGuard }), [setGuard]);

  function confirmLeave() {
    const href = pending;
    setPending(null);
    try {
      guardRef.current?.onConfirm();
    } catch {
      /* ignore */
    }
    // Let the socket flush (e.g. the resign event) before we unmount the game page.
    if (href) setTimeout(() => router.push(href), 250);
  }

  return (
    <NavGuardContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={!!pending}
        title="Leave the game?"
        message={guard?.message ?? "Are you sure you want to leave?"}
        confirmLabel="Leave & resign"
        cancelLabel="Keep playing"
        danger
        onConfirm={confirmLeave}
        onCancel={() => setPending(null)}
      />
    </NavGuardContext.Provider>
  );
}
