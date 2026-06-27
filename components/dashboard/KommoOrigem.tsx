"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/utils";
import type { KommoDashboardData } from "@/lib/kommo";

interface KommoOrigemProps {
  data: KommoDashboardData | null;
  loading?: boolean;
}

const ORIGIN_COLORS = [
  "bg-meta-blue/75",
  "bg-violet-500/75",
  "bg-emerald-500/75",
  "bg-amber-500/75",
  "bg-cyan-500/75",
  "bg-rose-500/75",
];

export function KommoOrigem({ data, loading }: KommoOrigemProps) {
  if (loading || !data) {
    return (
      <Card>
        <CardHeader className="pb-3"><Skeleton className="h-4 w-40" /></CardHeader>
        <CardContent><div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div></CardContent>
      </Card>
    );
  }

  const total = Math.max(data.totalLeads, 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Origem da Conversão</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {data.bySource.map((item, idx) => {
            const pct = (item.count / total) * 100;
            const convPct = item.count > 0 ? (item.matriculas / item.count) * 100 : 0;
            const color = ORIGIN_COLORS[idx % ORIGIN_COLORS.length];
            return (
              <div key={item.source}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium truncate max-w-[60%]">{item.source}</span>
                  <div className="flex items-center gap-2 font-mono text-muted-foreground shrink-0">
                    <span className="text-[10px]">{convPct.toFixed(0)}% conv.</span>
                    <span className="font-semibold text-foreground">{formatNumber(item.count)}</span>
                  </div>
                </div>
                <div className="relative h-6 w-full overflow-hidden rounded-md bg-muted/50">
                  <div
                    className={`h-full rounded-md transition-all ${color}`}
                    style={{ width: `${Math.max(pct, item.count > 0 ? 3 : 0)}%` }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-foreground/60">
                    {pct.toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-meta-blue/75" />Leads</span>
          <span>· % conv. = matrículas ÷ leads da origem</span>
        </div>
      </CardContent>
    </Card>
  );
}
