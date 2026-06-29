"use client";

import { useMemo } from "react";
import { useDashboard } from "@/lib/dashboard-context";
import { GeoMap } from "@/components/dashboard/GeoMap";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    .filter((r) => r.impressions > 0 || r.spend > 0)
    .sort((a, b) => b.impressions - a.impressions);
}

interface DemoBarsProps {
  rows: BreakdownItem[];
  title: string;
  loading: boolean;
}

function DemoBars({ rows, title, loading }: DemoBarsProps) {
  const maxImpressions = rows.reduce((m, r) => (r.impressions > m ? r.impressions : m), 0) || 1;
  const totalSpend = rows.reduce((s, r) => s + (Number(r.spend) || 0), 0);

  if (loading) return (
    <Card>
      <CardHeader className="pb-2"><Skeleton className="h-4 w-44" /></CardHeader>
      <CardContent><div className="space-y-3">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div></CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Sem dados de segmentação</p>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => {
              const cpl = (r.leads ?? 0) > 0 ? r.spend / (r.leads ?? 1) : null;
              const spendShare = totalSpend > 0 ? (r.spend / totalSpend) * 100 : 0;
              const barW = Math.min((r.impressions / maxImpressions) * 100, 100);
              const ctr = r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0;
              return (
                <div key={r.segment}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium w-32 truncate">{r.segment}</span>
                    <div className="flex items-center gap-3 font-mono text-muted-foreground">
                      <span>{formatPercent(spendShare, 1)} gasto</span>
                      <span>{formatPercent(ctr, 1)} CTR</span>
                      {cpl !== null && (
                        <span className={`font-medium ${cpl < 80 ? "text-success" : ""}`}>
                          {formatCurrency(cpl)} CPL
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-meta-blue/60 transition-all" style={{ width: `${barW}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{formatNumber(r.impressions)} impressões · {formatCurrency(r.spend)}</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PublicoPage() {
  const { insights, geoData, loadingInsights, loadingGeo } = useDashboard();

  const ageGender = useMemo(() => aggregateBreakdown(insights, "breakdown_age_gender"), [insights]);
  const platform = useMemo(() => aggregateBreakdown(insights, "breakdown_platform"), [insights]);
  const device = useMemo(() => aggregateBreakdown(insights, "breakdown_device"), [insights]);

  // Best CPL segments
  const bestSegments = useMemo(() => {
    return ageGender
      .filter((r) => (r.leads ?? 0) > 0 && r.spend > 0)
      .map((r) => ({ ...r, cpl: r.spend / (r.leads ?? 1) }))
      .sort((a, b) => a.cpl - b.cpl)
      .slice(0, 3);
  }, [ageGender]);

  return (
    <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
      <div className="space-y-5">
        {/* Geo map */}
        <GeoMap geoData={geoData} loading={loadingGeo} />

        {/* Best CPL segments callout */}
        {!loadingInsights && bestSegments.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {bestSegments.map((seg, i) => (
              <div key={seg.segment} className="rounded-lg border border-success/30 bg-success/5 px-4 py-3">
                <p className="text-[10px] text-muted-foreground mb-1">#{i + 1} Menor CPL — {seg.segment}</p>
                <p className="font-mono text-lg font-bold text-success">{formatCurrency(seg.cpl)}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{seg.leads ?? 0} leads · {formatCurrency(seg.spend)} gasto</p>
              </div>
            ))}
          </div>
        )}

        {/* Demographics breakdown matrix */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <DemoBars rows={ageGender} title="Idade e Gênero" loading={loadingInsights} />
          <DemoBars rows={platform} title="Plataforma" loading={loadingInsights} />
        </div>

        <DemoBars rows={device} title="Dispositivo" loading={loadingInsights} />
      </div>
    </main>
  );
}
