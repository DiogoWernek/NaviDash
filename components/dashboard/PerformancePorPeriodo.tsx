"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { DailyInsight } from "@/types";

interface PerformancePorPeriodoProps {
  insights: DailyInsight[];
  loading?: boolean;
}

const BAR_HEIGHT = 80;

function scaleBar(value: number, max: number) {
  if (max === 0) return 0;
  return Math.max((value / max) * BAR_HEIGHT, value > 0 ? 4 : 0);
}

export function PerformancePorPeriodo({ insights, loading }: PerformancePorPeriodoProps) {
  const data = useMemo(() => {
    const byDate: Record<string, { spend: number; leads: number; revenue: number }> = {};
    for (const row of insights) {
      const date = row.date;
      if (!byDate[date]) byDate[date] = { spend: 0, leads: 0, revenue: 0 };
      byDate[date].spend += row.spend;
      byDate[date].leads += row.leads ?? 0;
      byDate[date].revenue += row.revenue ?? 0;
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v }));
  }, [insights]);

  const maxSpend = useMemo(() => Math.max(...data.map((d) => d.spend), 1), [data]);
  const maxLeads = useMemo(() => Math.max(...data.map((d) => d.leads), 1), [data]);
  const maxRevenue = useMemo(() => Math.max(...data.map((d) => d.revenue), 1), [data]);
  const hasRevenue = data.some((d) => d.revenue > 0);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2"><Skeleton className="h-4 w-52" /></CardHeader>
        <CardContent><Skeleton className="h-40 w-full" /></CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Performance por Período</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground py-4 text-center">Sem dados no período selecionado</p>
        </CardContent>
      </Card>
    );
  }

  const showLabels = data.length <= 14;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Performance por Período</CardTitle>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-meta-blue" />Investimento</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-violet-500" />Leads</span>
            {hasRevenue && <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" />Faturamento</span>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="flex items-end gap-1 min-w-0" style={{ minWidth: data.length * 32, height: BAR_HEIGHT + 40 }}>
            {data.map((d) => {
              const labelDate = d.date.slice(5); // MM-DD
              const spendH = scaleBar(d.spend, maxSpend);
              const leadsH = scaleBar(d.leads, maxLeads);
              const revenueH = hasRevenue ? scaleBar(d.revenue, maxRevenue) : 0;

              return (
                <div key={d.date} className="group flex flex-col items-center flex-1 min-w-[24px]">
                  {/* Tooltip on hover */}
                  <div className="hidden group-hover:flex flex-col items-center absolute z-10 -translate-y-full -mt-1 pointer-events-none">
                    <div className="bg-popover border border-border rounded-md px-2 py-1.5 shadow-md text-[10px] space-y-0.5 whitespace-nowrap">
                      <p className="font-medium">{d.date}</p>
                      <p className="text-meta-blue">Invest: {formatCurrency(d.spend)}</p>
                      <p className="text-violet-500">Leads: {formatNumber(d.leads)}</p>
                      {hasRevenue && <p className="text-emerald-500">Fat: {formatCurrency(d.revenue)}</p>}
                    </div>
                  </div>

                  {/* Bars container */}
                  <div className="relative flex items-end gap-px w-full" style={{ height: BAR_HEIGHT }}>
                    <div
                      title={`Invest: ${formatCurrency(d.spend)}`}
                      className="flex-1 rounded-t bg-meta-blue/70 hover:bg-meta-blue transition-colors cursor-default"
                      style={{ height: spendH }}
                    />
                    <div
                      title={`Leads: ${d.leads}`}
                      className="flex-1 rounded-t bg-violet-500/70 hover:bg-violet-500 transition-colors cursor-default"
                      style={{ height: leadsH }}
                    />
                    {hasRevenue && (
                      <div
                        title={`Fat: ${formatCurrency(d.revenue)}`}
                        className="flex-1 rounded-t bg-emerald-500/70 hover:bg-emerald-500 transition-colors cursor-default"
                        style={{ height: revenueH }}
                      />
                    )}
                  </div>

                  {showLabels && (
                    <p className="text-[9px] text-muted-foreground mt-1 rotate-45 origin-left translate-x-1">{labelDate}</p>
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
