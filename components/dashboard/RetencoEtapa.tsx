"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatPercent, formatCurrency } from "@/lib/utils";
import type { DailyInsight } from "@/types";

interface RetencoEtapaProps {
  insights: DailyInsight[];
  loading?: boolean;
}

export function RetencoEtapa({ insights, loading }: RetencoEtapaProps) {
  const data = useMemo(() => {
    const plays = insights.reduce((s, i) => s + (i.video_plays ?? 0), 0);
    const thruplay = insights.reduce((s, i) => s + (i.video_thruplay ?? 0), 0);
    const avgTime = insights.length > 0
      ? insights.reduce((s, i) => s + (i.video_avg_time ?? 0), 0) / insights.filter((i) => (i.video_plays ?? 0) > 0).length
      : 0;
    const spend = insights.reduce((s, i) => s + i.spend, 0);
    const impressions = insights.reduce((s, i) => s + i.impressions, 0);
    const p25 = insights.reduce((s, i) => s + (i.video_p25 ?? 0), 0);
    const p50 = insights.reduce((s, i) => s + (i.video_p50 ?? 0), 0);
    const p75 = insights.reduce((s, i) => s + (i.video_p75 ?? 0), 0);
    const p100 = insights.reduce((s, i) => s + (i.video_p100 ?? 0), 0);
    const custoThruplay = thruplay > 0 ? spend / thruplay : 0;
    const hookRate = impressions > 0 ? (plays / impressions) * 100 : 0;

    return { plays, thruplay, avgTime, custoThruplay, hookRate, impressions, p25, p50, p75, p100 };
  }, [insights]);

  const hasVideoData = data.plays > 0;

  const summaryCards = [
    { label: "Visualizações (3s+)", value: formatNumber(data.plays), sub: `Hook ${data.hookRate.toFixed(1)}%` },
    { label: "Tempo Médio", value: `${data.avgTime.toFixed(1)}s`, sub: "média de reprodução" },
    { label: "ThruPlay", value: formatNumber(data.thruplay), sub: data.plays > 0 ? `${((data.thruplay / data.plays) * 100).toFixed(1)}% das plays` : "—" },
    { label: "Custo / ThruPlay", value: data.custoThruplay > 0 ? formatCurrency(data.custoThruplay) : "—", sub: "por reprodução completa" },
  ];

  const retencaoMarcos = [
    { label: "3s Hook", pct: data.impressions > 0 ? (data.plays / data.impressions) * 100 : 0, ref: 20 },
    { label: "15s / ThruPlay", pct: data.plays > 0 ? (data.thruplay / data.plays) * 100 : 0, ref: 15 },
    { label: "25% Início", pct: data.plays > 0 ? (data.p25 / data.plays) * 100 : 0, ref: null },
    { label: "50% Meio", pct: data.plays > 0 ? (data.p50 / data.plays) * 100 : 0, ref: null },
    { label: "75% Avançado", pct: data.plays > 0 ? (data.p75 / data.plays) * 100 : 0, ref: null },
    { label: "100% Completo", pct: data.plays > 0 ? (data.p100 / data.plays) * 100 : 0, ref: null },
  ];

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2"><Skeleton className="h-4 w-52" /></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-3">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-16" />)}</div>
          <div className="grid grid-cols-6 gap-2">{[0,1,2,3,4,5].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        </CardContent>
      </Card>
    );
  }

  if (!hasVideoData) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Engajamento de Vídeo — Retenção por Etapa</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground py-4 text-center">Sem dados de vídeo no período selecionado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Engajamento de Vídeo — Retenção por Etapa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 4 summary cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summaryCards.map((c) => (
            <div key={c.label} className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
              <p className="text-[10px] text-muted-foreground mb-1">{c.label}</p>
              <p className="font-mono text-base font-bold">{c.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* 6 retention milestone mini-cards */}
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium">Retenção por Marco</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {retencaoMarcos.map((m) => {
              const isGood = m.ref !== null ? m.pct >= m.ref : m.pct >= 10;
              return (
                <div key={m.label} className={`rounded-lg border px-2 py-2 text-center ${isGood ? "border-success/30 bg-success/5" : "border-border/50 bg-muted/10"}`}>
                  <p className="text-[10px] text-muted-foreground mb-1">{m.label}</p>
                  <p className={`font-mono text-sm font-bold ${isGood ? "text-success" : "text-foreground"}`}>
                    {formatPercent(m.pct, 1)}
                  </p>
                  {m.ref !== null && (
                    <p className="text-[9px] text-muted-foreground mt-0.5">ref {m.ref}%</p>
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
