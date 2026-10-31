"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import type { ReportConfig, ReportSection, ReportSource } from "@/lib/reports/contracts";

type View = { filters?: Partial<ReportConfig>; section?: ReportSection; ready?: boolean };
type Staged = { scope: "ndc" | "all"; section: ReportSection };
const ReportContext = createContext<{
  source: ReportSource | null;
  sourceReady: boolean;
  registerSource: (path: string, scope: "ndc" | "all", source: ReportSource | null) => void;
  views: Record<string, View>;
  register: (path: string, view: View) => void;
  staged: Staged | null;
  stage: (value: Staged | null) => void;
} | null>(null);

export function ReportProvider({ scope, children }: { scope: "ndc" | "all"; children: ReactNode }) {
  const pathname = usePathname();
  const [entry, setEntry] = useState<{ path: string; scope: "ndc" | "all"; source: ReportSource | null } | null>(null);
  const [views, setViews] = useState<Record<string, View>>({});
  const [staged, stage] = useState<Staged | null>(null);
  const registerSource = useCallback((path: string, scope: "ndc" | "all", source: ReportSource | null) => {
    setEntry({ path, scope, source });
  }, []);
  const register = useCallback((path: string, view: View) => {
    setViews(previous => ({ ...previous, [path]: view }));
  }, []);
  const sourceReady = entry?.path === pathname && entry.scope === scope;
  const source = sourceReady ? entry.source : null;
  return <ReportContext.Provider value={{ source, sourceReady, registerSource, views, register, staged, stage }}>{children}</ReportContext.Provider>;
}

export function ReportSourceRegistration({ source, scope }: { source: ReportSource | null; scope: "ndc" | "all" }) {
  const pathname = usePathname();
  const registerSource = useReportContext()?.registerSource;
  useEffect(() => {
    registerSource?.(pathname, scope, source);
    return () => registerSource?.(pathname, scope, null);
  }, [registerSource, pathname, scope, source]);
  return null;
}

export function useReportContext() {
  return useContext(ReportContext);
}

export function useReportView(view?: View) {
  const pathname = usePathname();
  const context = useReportContext();
  const register = context?.register;
  const serialized = JSON.stringify(view);
  useEffect(() => {
    if (!register || serialized === undefined) return;
    register(pathname, JSON.parse(serialized));
    return () => register(pathname, {});
  }, [register, pathname, serialized]);
}
