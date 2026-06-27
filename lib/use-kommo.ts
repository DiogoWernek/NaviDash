"use client";

import { useState, useEffect } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { dateToString } from "@/lib/utils";
import type { KommoDashboardData } from "@/lib/kommo";

export function useKommo() {
  const { currentFilters, insights } = useDashboard();
  const [data, setData] = useState<KommoDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentFilters) return;
    const { dateRange } = currentFilters;
    const from = dateToString(dateRange.from);
    const to = dateToString(dateRange.to);
    const spend = insights.reduce((s, i) => s + i.spend, 0);

    setLoading(true);
    setError(null);

    fetch(`/api/kommo?from=${from}&to=${to}&spend=${spend}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<KommoDashboardData>;
      })
      .then((d) => setData(d))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [currentFilters, insights]);

  return { data, loading, error };
}
