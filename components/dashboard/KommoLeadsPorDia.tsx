"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/utils";
import type { KommoDashboardData } from "@/lib/kommo";

interface KommoLeadsPorDiaProps {
  data: KommoDashboardData | null;
  loading?: boolean;
}

const BAR_HEIGHT = 72;

function scaleBar(value: number, max: number) {
  if (max === 0 || value === 0) return 0;
  return Math.max((value / max) * BAR_HEIGHT, 4);
}

export function KommoLeadsPorDia({ data, loading }: KommoLeadsPorDiaProps) {
  if (loading || !data) {
    return (
      <Card>
        <CardHeader className="pb-2"><Skeleton className="h-4 w-52" /></CardHeader>
        <CardContent><Skeleton className="h-36 w-full" /></CardContent>
      </Card>
    );
  }

  const days = data.byDay;
  if (days.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Leads por Dia</CardTitle></CardHeader>
        <CardContent><p className="text-xs text-muted-foreground py-4 text-center">Sem dados no período</p></CardContent>
      </Card>
    );
  }

  const maxLeads = Math.max(...days.map((d) => d.leads), 1);
  const showLabels = days.length <= 14;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Leads por Dia</CardTitle>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-violet-500/70" />Leads</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/80" />Matrículas</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div
            className="flex items-end gap-1 min-w-0"
            style={{ minWidth: days.length * 32, height: BAR_HEIGHT + 110 }}
          >
            {days.map((d) => {
              const leadsH = scaleBar(d.leads, maxLeads);
              const matriculasH = scaleBar(d.matriculas, maxLeads);
              const label = d.date.slice(5); // MM-DD
              return (
                <div key={d.date} className="group relative flex flex-col items-center flex-1 min-w-[24px]">
                  {/* Hover tooltip */}
                  <div className="hidden group-hover:flex flex-col items-center absolute z-10 -translate-y-full -mt-1 pointer-events-none">
                    <div className="bg-popover border border-border rounded-md px-2 py-1.5 shadow-md text-[10px] space-y-0.5 whitespace-nowrap">
                      <p className="font-medium">{d.date}</p>
                      <p className="text-violet-500">Leads: {formatNumber(d.leads)}</p>
                      <p className="text-emerald-500">Matrículas: {formatNumber(d.matriculas)}</p>
                    </div>
                  </div>

                  {/* Bars */}
                  <div className="relative flex items-end gap-px w-full" style={{ height: BAR_HEIGHT }}>
                    <div
                      className="flex-1 rounded-t bg-violet-500/70 hover:bg-violet-500 transition-colors cursor-default"
                      style={{ height: leadsH }}
                    />
                    <div
                      className="flex-1 rounded-t bg-emerald-500/80 hover:bg-emerald-500 transition-colors cursor-default"
                      style={{ height: matriculasH }}
                    />
                  </div>

                  {showLabels && (
                    <p className="text-[9px] text-muted-foreground mt-1 rotate-45 origin-left translate-x-1">
                      {label}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
