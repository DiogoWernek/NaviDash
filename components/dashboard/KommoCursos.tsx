"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatCurrency } from "@/lib/utils";
import type { KommoDashboardData } from "@/lib/kommo";

interface KommoCursosProps {
  data: KommoDashboardData | null;
  loading?: boolean;
}

export function KommoCursos({ data, loading }: KommoCursosProps) {
  if (loading || !data) {
    return (
      <Card>
        <CardHeader className="pb-3"><Skeleton className="h-4 w-48" /></CardHeader>
        <CardContent><div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div></CardContent>
      </Card>
    );
  }

  const maxLeads = Math.max(...data.byCourse.map((c) => c.leads), 1);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Leads e Matrículas por Curso</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border text-left text-[11px] text-muted-foreground">
                <th className="pb-2 font-medium w-[35%]">Curso</th>
                <th className="pb-2 font-medium text-right">Leads</th>
                <th className="pb-2 font-medium text-right">Matrículas</th>
                <th className="pb-2 font-medium text-right hidden sm:table-cell">Faturamento</th>
                <th className="pb-2 font-medium text-right hidden md:table-cell">CPA est.</th>
                <th className="pb-2 w-[25%] hidden lg:table-cell" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data.byCourse.map((item) => {
                const convPct = item.leads > 0 ? (item.matriculas / item.leads) * 100 : 0;
                return (
                  <tr key={item.course} className="group">
                    <td className="py-2.5 pr-4">
                      <span className="font-medium text-foreground truncate block max-w-[180px]">{item.course}</span>
                    </td>
                    <td className="py-2.5 text-right font-mono">{formatNumber(item.leads)}</td>
                    <td className="py-2.5 text-right font-mono">
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatNumber(item.matriculas)}</span>
                      <span className="ml-1 text-[10px] text-muted-foreground">({convPct.toFixed(0)}%)</span>
                    </td>
                    <td className="py-2.5 text-right font-mono hidden sm:table-cell text-cyan-600 dark:text-cyan-400">
                      {item.revenue > 0 ? formatCurrency(item.revenue) : "—"}
                    </td>
                    <td className="py-2.5 text-right font-mono hidden md:table-cell text-amber-600 dark:text-amber-400">
                      {item.cpa > 0 ? formatCurrency(item.cpa) : "—"}
                    </td>
                    <td className="py-2.5 pl-4 hidden lg:table-cell">
                      {/* Mini bar: leads (bg) + matrículas (fill) */}
                      <div className="relative h-4 w-full overflow-hidden rounded bg-violet-500/15">
                        <div
                          className="absolute h-full rounded bg-violet-500/70"
                          style={{ width: `${(item.leads / maxLeads) * 100}%` }}
                        />
                        <div
                          className="absolute h-full rounded bg-emerald-500/80"
                          style={{ width: `${(item.matriculas / maxLeads) * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-violet-500/70" />Leads</span>
          <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500/80" />Matrículas</span>
          <span className="ml-auto">CPA est. = gasto Meta proporcional aos leads ÷ matrículas</span>
        </div>
      </CardContent>
    </Card>
  );
}
