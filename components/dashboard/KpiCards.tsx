"use client";

import { useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Eye,
  MousePointerClick,
  Percent,
  Activity,
  BarChart2,
  Users,
  Target,
  Info,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRoas,
  formatVariation,
} from "@/lib/utils";
import type { DailyInsight, KpiSummary } from "@/types";

interface KpiCardsProps {
  insights: DailyInsight[];
  previousInsights: DailyInsight[];
  loading?: boolean;
  periodLabel?: string;
}

function sumInsights(insights: DailyInsight[]): KpiSummary {
  if (insights.length === 0) {
    return {
      spend: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      cpm: 0,
      cpc: 0,
      roas: 0,
      reach: 0,
      conversions: 0,
      cpa: 0,
      frequency: 0,
    };
  }

  const totalSpend = insights.reduce((s, i) => s + i.spend, 0);
  const totalImpressions = insights.reduce((s, i) => s + i.impressions, 0);
  const totalClicks = insights.reduce((s, i) => s + i.clicks, 0);
  const totalReach = insights.reduce((s, i) => s + i.reach, 0);
  const totalConversions = insights.reduce((s, i) => s + i.conversions, 0);

  const avgCtr =
    totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const avgCpm =
    totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
  const avgCpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const totalRoas =
    insights.reduce((s, i) => s + i.roas * i.spend, 0) / (totalSpend || 1);
  const avgFrequency =
    totalReach > 0 ? totalImpressions / totalReach : 0;
  const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;

  return {
    spend: totalSpend,
    impressions: totalImpressions,
    clicks: totalClicks,
    ctr: avgCtr,
    cpm: avgCpm,
    cpc: avgCpc,
    roas: totalRoas,
    reach: totalReach,
    conversions: totalConversions,
    cpa,
    frequency: avgFrequency,
  };
}

const KPI_DEFS = [
  {
    key: "spend" as keyof KpiSummary,
    label: "Investimento",
    tooltip: "Total investido em tráfego pago no período",
    icon: DollarSign,
    format: formatCurrency,
    color: "text-meta-blue",
    bgColor: "bg-meta-blue/10",
    higherIsBetter: false,
  },
  {
    key: "reach" as keyof KpiSummary,
    label: "Alcance",
    tooltip: "Número de pessoas únicas que viram seus anúncios",
    icon: Users,
    format: formatNumber,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    higherIsBetter: true,
  },
  {
    key: "impressions" as keyof KpiSummary,
    label: "Impressões",
    tooltip: "Total de vezes que seus anúncios foram exibidos (inclui re-exibições para a mesma pessoa)",
    icon: Eye,
    format: formatNumber,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    higherIsBetter: true,
  },
  {
    key: "clicks" as keyof KpiSummary,
    label: "Cliques no Link",
    tooltip: "Cliques no link dos anúncios que direcionam para fora do Meta",
    icon: MousePointerClick,
    format: formatNumber,
    color: "text-teal-500",
    bgColor: "bg-teal-500/10",
    higherIsBetter: true,
  },
  {
    key: "ctr" as keyof KpiSummary,
    label: "CTR",
    tooltip: "Taxa de Clique — percentual de pessoas que viram o anúncio e clicaram. Acima de 1% é considerado bom",
    icon: Percent,
    format: (v: number) => formatPercent(v),
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    higherIsBetter: true,
  },
  {
    key: "cpm" as keyof KpiSummary,
    label: "CPM Médio",
    tooltip: "Custo por Mil Impressões — quanto custa exibir o anúncio 1.000 vezes",
    icon: Activity,
    format: formatCurrency,
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    higherIsBetter: false,
  },
  {
    key: "cpa" as keyof KpiSummary,
    label: "CPA",
    tooltip: "Custo por Aquisição — quanto custa cada conversão. Calculado como Gasto ÷ Conversões",
    icon: Target,
    format: (v: number) => v > 0 ? formatCurrency(v) : "—",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    higherIsBetter: false,
  },
  {
    key: "roas" as keyof KpiSummary,
    label: "ROAS",
    tooltip: "Retorno sobre Investimento em Anúncios. Acima de 1,0x significa retorno positivo",
    icon: BarChart2,
    format: (v: number) => v > 0 ? formatRoas(v) : "—",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    higherIsBetter: true,
  },
];

const VARIATION_TOOLTIP =
  "Comparado ao período anterior de mesma duração. Ex: se você selecionou os últimos 7 dias, compara com os 7 dias anteriores a esse período.";

function KpiSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
        <Skeleton className="mt-3 h-8 w-32" />
        <Skeleton className="mt-2 h-3 w-20" />
      </CardContent>
    </Card>
  );
}

export function KpiCards({ insights, previousInsights, loading }: KpiCardsProps) {
  const current = useMemo(() => sumInsights(insights), [insights]);
  const previous = useMemo(() => sumInsights(previousInsights), [previousInsights]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KPI_DEFS.map((kpi, index) => {
          const currentValue = current[kpi.key] as number;
          const previousValue = previous[kpi.key] as number;
          const variation = formatVariation(currentValue, previousValue);
          const isPositiveChange = kpi.higherIsBetter
            ? variation.positive
            : !variation.positive;

          return (
            <Card
              key={kpi.key}
              className="group overflow-hidden transition-all hover:border-border/80 hover:shadow-md"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {kpi.label}
                    </p>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                          <Info className="h-3 w-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-56 text-xs">
                        {kpi.tooltip}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${kpi.bgColor} transition-transform group-hover:scale-110`}
                  >
                    <kpi.icon className={`h-3.5 w-3.5 ${kpi.color}`} />
                  </div>
                </div>

                <p className="mt-2.5 font-mono text-xl font-bold tracking-tight">
                  {kpi.format(currentValue)}
                </p>

                {variation.value !== "—" ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="mt-1.5 flex items-center gap-1 cursor-help w-fit">
                        {isPositiveChange ? (
                          <TrendingUp className="h-3 w-3 text-success" />
                        ) : (
                          <TrendingDown className="h-3 w-3 text-danger" />
                        )}
                        <span
                          className={`text-xs font-medium ${
                            isPositiveChange ? "text-success" : "text-danger"
                          }`}
                        >
                          {variation.value}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          vs anterior
                        </span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-64 text-xs">
                      {VARIATION_TOOLTIP}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Sem comparativo
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
