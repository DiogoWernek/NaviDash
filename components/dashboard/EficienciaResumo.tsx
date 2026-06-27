"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatPercent } from "@/lib/utils";
import type { DailyInsight } from "@/types";

interface EficienciaResumoProps {
  insights: DailyInsight[];
  loading?: boolean;
}

export function EficienciaResumo({ insights, loading }: EficienciaResumoProps) {
  const kpis = useMemo(() => {
    const spend = insights.reduce((s, i) => s + i.spend, 0);
    const impressions = insights.reduce((s, i) => s + i.impressions, 0);
    const clicks = insights.reduce((s, i) => s + i.clicks, 0);
    const leads = insights.reduce((s, i) => s + (i.leads ?? 0), 0);
    const revenue = insights.reduce((s, i) => s + (i.revenue ?? 0), 0);

    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const cpl = leads > 0 ? spend / leads : 0;
    const roas = revenue > 0 && spend > 0 ? revenue / spend : null;

    return { spend, impressions, clicks, leads, revenue, ctr, cpc, cpl, roas };
  }, [insights]);

  const autoPhrase = useMemo(() => {
    if (!insights.length) return null;
    const { cpl, ctr, roas } = kpis;
    const phrases: string[] = [];

    if (cpl > 0 && cpl < 30) phrases.push(`CPL de ${formatCurrency(cpl)} está excelente.`);
    else if (cpl > 100) phrases.push(`CPL de ${formatCurrency(cpl)} está acima do ideal — revise segmentação.`);

    if (ctr > 2) phrases.push(`CTR de ${formatPercent(ctr, 2)} está acima da média de mercado.`);
    else if (ctr < 0.5 && ctr > 0) phrases.push(`CTR de ${formatPercent(ctr, 2)} está baixo — teste novos criativos.`);

    if (roas && roas > 3) phrases.push(`ROAS de ${roas.toFixed(2)}x indica campanhas lucrativas.`);
    else if (roas && roas < 1) phrases.push(`ROAS abaixo de 1x — gasto supera receita gerada.`);

    return phrases.length > 0 ? phrases.join(" ") : "Métricas de eficiência dentro do esperado para o período.";
  }, [insights, kpis]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2"><Skeleton className="h-4 w-48" /></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    { label: "CTR", value: formatPercent(kpis.ctr, 2), ref: "> 1%", good: kpis.ctr >= 1 },
    { label: "CPC", value: formatCurrency(kpis.cpc), ref: null, good: null },
    { label: "CPL", value: kpis.cpl > 0 ? formatCurrency(kpis.cpl) : "—", ref: null, good: null },
    ...(kpis.roas !== null
      ? [{ label: "ROAS", value: `${kpis.roas.toFixed(2)}x`, ref: "> 1x", good: kpis.roas >= 1 }]
      : [{ label: "Conv/Clique", value: kpis.clicks > 0 && kpis.leads > 0 ? formatPercent((kpis.leads / kpis.clicks) * 100, 1) : "—", ref: null, good: null }]),
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Resumo de Eficiência</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.label} className={`rounded-lg border px-3 py-2.5 ${m.good === true ? "border-success/30 bg-success/5" : m.good === false ? "border-danger/30 bg-danger/5" : "border-border/50 bg-muted/20"}`}>
              <p className="text-[10px] text-muted-foreground mb-1">{m.label}</p>
              <p className="font-mono text-base font-bold">{m.value}</p>
              {m.ref && <p className="text-[10px] text-muted-foreground mt-0.5">ref {m.ref}</p>}
            </div>
          ))}
        </div>

        {autoPhrase && (
          <div className="rounded-lg bg-muted/30 border border-border/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">{autoPhrase}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
