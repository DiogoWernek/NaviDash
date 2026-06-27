"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatPercent } from "@/lib/utils";
import type { DailyInsight } from "@/types";

interface JornadaFunilProps {
  insights: DailyInsight[];
  loading?: boolean;
}

export function JornadaFunil({ insights, loading }: JornadaFunilProps) {
  const funil = useMemo(() => {
    const impressions = insights.reduce((s, i) => s + i.impressions, 0);
    const reach = insights.reduce((s, i) => s + i.reach, 0);
    const clicks = insights.reduce((s, i) => s + i.clicks, 0);
    const linkClicks = insights.reduce((s, i) => s + (i.link_clicks ?? 0), 0);
    const leads = insights.reduce((s, i) => s + (i.leads ?? 0), 0);

    const etapas = [
      { label: "Impressões", value: impressions, prev: null },
      { label: "Alcance Único", value: reach, prev: impressions },
      { label: "Cliques", value: clicks, prev: reach },
      { label: "Cliques no Link", value: linkClicks || clicks, prev: clicks },
      { label: "Leads", value: leads, prev: linkClicks || clicks },
    ];

    return etapas.map((e, idx) => ({
      ...e,
      pct: e.prev ? (e.value / e.prev) * 100 : 100,
      width: impressions > 0 ? Math.max((e.value / impressions) * 100, 4) : 0,
    }));
  }, [insights]);

  // Detect bottleneck: step with lowest conversion (excluding first)
  const bottleneckIdx = useMemo(() => {
    let minPct = Infinity;
    let idx = -1;
    funil.forEach((e, i) => {
      if (i > 0 && e.prev && e.prev > 0 && e.pct < minPct) {
        minPct = e.pct;
        idx = i;
      }
    });
    return idx;
  }, [funil]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3"><Skeleton className="h-4 w-40" /></CardHeader>
        <CardContent><div className="space-y-3">{[0,1,2,3,4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Jornada do Funil</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {funil.map((e, idx) => (
            <div key={e.label} className="group">
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-medium">
                  {e.label}
                  {idx === bottleneckIdx && (
                    <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400 font-medium">gargalo</span>
                  )}
                </span>
                <span className="font-mono text-muted-foreground">{formatNumber(e.value)}</span>
              </div>
              <div className="relative h-7 w-full overflow-hidden rounded-md bg-muted/50">
                <div
                  className={`h-full rounded-md transition-all ${idx === bottleneckIdx ? "bg-amber-500/70" : "bg-meta-blue/70"}`}
                  style={{ width: `${e.width}%` }}
                />
                {e.prev !== null && e.prev > 0 && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[11px] font-medium text-foreground/70">
                    {formatPercent(e.pct, 1)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
