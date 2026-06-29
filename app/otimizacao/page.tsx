"use client";

import { useMemo } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatNumber, formatPercent, normalizeSegment } from "@/lib/utils";
import type { DailyInsight, BreakdownItem } from "@/types";

function aggregateBreakdown(
  insights: DailyInsight[],
  field: "breakdown_platform" | "breakdown_device" | "breakdown_age_gender"
): BreakdownItem[] {
  const map = new Map<string, BreakdownItem>();
  for (const insight of insights) {
    for (const item of (insight[field] ?? [])) {
      const seg = normalizeSegment(item.segment);
      const spend = Number(item.spend) || 0;
      const impressions = Number(item.impressions) || 0;
      const clicks = Number(item.clicks) || 0;
      const leads = Number(item.leads) || 0;
      const ex = map.get(seg);
      if (ex) {
        ex.spend += spend;
        ex.impressions += impressions;
        ex.clicks += clicks;
        ex.leads = (ex.leads ?? 0) + leads;
      } else {
        map.set(seg, { ...item, segment: seg, spend, impressions, clicks, leads });
      }
    }
  }
  return Array.from(map.values())
    .filter((r) => r.spend > 0 || (r.impressions ?? 0) > 0)
    .sort((a, b) => b.spend - a.spend);
}

interface BreakdownEfficiencyProps {
  title: string;
  rows: BreakdownItem[];
  loading?: boolean;
}

function BreakdownEfficiency({ title, rows, loading }: BreakdownEfficiencyProps) {
  if (loading) return (
    <Card>
      <CardHeader className="pb-2"><Skeleton className="h-4 w-48" /></CardHeader>
      <CardContent><div className="space-y-2">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div></CardContent>
    </Card>
  );

  const maxSpend = rows.reduce((m, r) => (r.spend > m ? r.spend : m), 0) || 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3 text-center">Sem dados de segmentação</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const cpl = (r.leads ?? 0) > 0 ? r.spend / (r.leads ?? 1) : null;
              const ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0;
              const barW = Math.min((r.spend / maxSpend) * 100, 100);
              return (
                <div key={r.segment} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium truncate max-w-[40%]">{r.segment}</span>
                    <div className="flex items-center gap-3 font-mono text-muted-foreground shrink-0">
                      <span className="text-foreground">{formatCurrency(r.spend)}</span>
                      <span>{formatPercent(ctr, 1)} CTR</span>
                      {cpl !== null && <span className="text-violet-400">{formatCurrency(cpl)} CPL</span>}
                    </div>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-meta-blue/70 transition-all duration-500"
                      style={{ width: `${barW}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function OtimizacaoPage() {
  const { insights, campaigns, loadingInsights, loadingCampaigns } = useDashboard();

  const platform = useMemo(() => aggregateBreakdown(insights, "breakdown_platform"), [insights]);
  const device = useMemo(() => aggregateBreakdown(insights, "breakdown_device"), [insights]);
  const ageGender = useMemo(() => aggregateBreakdown(insights, "breakdown_age_gender"), [insights]);

  // Campaign efficiency: rank by CPL (with leads), then CPA
  const campEfficiency = useMemo(() => {
    return campaigns
      .filter((c) => c.spend > 0)
      .map((c) => {
        const leads = c.leads_total ?? 0;
        const cpl = leads > 0 ? c.spend / leads : null;
        const msgConvs = c.messaging_conversations ?? 0;
        const custoConversa = msgConvs > 0 ? c.spend / msgConvs : null;
        return { ...c, _leads: leads, _cpl: cpl, _custoConversa: custoConversa };
      })
      .sort((a, b) => {
        // Sort: active with leads first, then by spend
        const aLeads = (a._leads ?? 0) > 0 ? 1 : 0;
        const bLeads = (b._leads ?? 0) > 0 ? 1 : 0;
        if (aLeads !== bLeads) return bLeads - aLeads;
        return b.spend - a.spend;
      });
  }, [campaigns]);

  return (
    <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
      <div className="space-y-5">

        {/* Block 1: Campaign efficiency table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Eficiência por Campanha</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingCampaigns ? (
              <div className="p-4 space-y-2">{[0,1,2,3,4].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
            ) : campEfficiency.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Sem dados de campanha no período</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Campanha</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">Gasto</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">Leads</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">CPL</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">Conversas</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">C/Conversa</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">ROAS</th>
                      <th className="px-3 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">CTR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campEfficiency.map((c) => (
                      <tr key={c.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-2.5 max-w-[260px]">
                          <div>
                            <p className="font-medium truncate" title={c.name}>{c.name}</p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Badge variant="outline" className="text-[9px] h-4 px-1">
                                {c.status === "ACTIVE" ? "Ativa" : "Pausada"}
                              </Badge>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">{formatCurrency(c.spend)}</td>
                        <td className="px-3 py-2.5 text-right font-mono">{c._leads > 0 ? formatNumber(c._leads) : "—"}</td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {c._cpl !== null ? (
                            <span className={c._cpl < 50 ? "text-success" : c._cpl > 150 ? "text-danger" : ""}>
                              {formatCurrency(c._cpl)}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {(c.messaging_conversations ?? 0) > 0 ? formatNumber(c.messaging_conversations!) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {c._custoConversa !== null ? formatCurrency(c._custoConversa) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">
                          {c.roas > 0 ? (
                            <span className={c.roas >= 1 ? "text-success" : "text-danger"}>
                              {c.roas.toFixed(2)}x
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono">{formatPercent(c.ctr, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Block 2: Platform + Device breakdowns */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <BreakdownEfficiency title="Eficiência por Plataforma" rows={platform} loading={loadingInsights} />
          <BreakdownEfficiency title="Eficiência por Dispositivo" rows={device} loading={loadingInsights} />
        </div>

        {/* Block 3: Age/Gender breakdown */}
        <BreakdownEfficiency title="Eficiência por Idade e Gênero" rows={ageGender} loading={loadingInsights} />

      </div>
    </main>
  );
}
