"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatCurrency } from "@/lib/utils";
import type { KommoDashboardData } from "@/lib/kommo";

interface KommoFunilProps {
  data: KommoDashboardData | null;
  loading?: boolean;
}

function stageColor(stage: string) {
  const s = stage.toLowerCase();
  if (s.includes("ganho")) return "bg-emerald-500/75";
  if (s.includes("perdido")) return "bg-rose-500/75";
  if (s.includes("pagamento")) return "bg-violet-500/75";
  if (s.includes("negoc")) return "bg-meta-blue/75";
  if (s.includes("standby")) return "bg-amber-500/75";
  return "bg-slate-500/50";
}

function stageBadge(stage: string) {
  const s = stage.toLowerCase();
  if (s.includes("ganho")) return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  if (s.includes("perdido")) return "bg-rose-500/15 text-rose-600 dark:text-rose-400";
  if (s.includes("pagamento")) return "bg-violet-500/15 text-violet-600 dark:text-violet-400";
  if (s.includes("negoc")) return "bg-meta-blue/15 text-meta-blue";
  if (s.includes("standby")) return "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  return "bg-muted text-muted-foreground";
}

export function KommoFunil({ data, loading }: KommoFunilProps) {
  if (loading || !data) {
    return (
      <Card>
        <CardHeader className="pb-3"><Skeleton className="h-4 w-40" /></CardHeader>
        <CardContent><div className="space-y-3">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div></CardContent>
      </Card>
    );
  }

  const total = Math.max(data.totalLeads, 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Etapa do Lead</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {data.byStage.map((item) => (
            <div key={item.stage}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${stageBadge(item.stage)}`}>
                  {item.stage}
                </span>
                <div className="flex items-center gap-3 font-mono text-muted-foreground">
                  {item.value > 0 && (
                    <span className="text-[10px]">{formatCurrency(item.value)}</span>
                  )}
                  <span className="font-semibold text-foreground">{formatNumber(item.count)}</span>
                </div>
              </div>
              <div className="relative h-6 w-full overflow-hidden rounded-md bg-muted/50">
                <div
                  className={`h-full rounded-md transition-all ${stageColor(item.stage)}`}
                  style={{ width: `${Math.max((item.count / total) * 100, item.count > 0 ? 3 : 0)}%` }}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[10px] text-foreground/60">
                  {total > 0 ? ((item.count / total) * 100).toFixed(1) : 0}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
