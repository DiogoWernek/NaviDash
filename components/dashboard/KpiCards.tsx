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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
}

function sumInsights(insights: DailyInsight[]): KpiSummary {
  if (insights.length === 0) {
    return {
      spend: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      cpm: 0,
      roas: 0,
      reach: 0,
      conversions: 0,
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
  const totalRoas =
    insights.reduce((s, i) => s + i.roas * i.spend, 0) / (totalSpend || 1);

  return {
    spend: totalSpend,
    impressions: totalImpressions,
    clicks: totalClicks,
    ctr: avgCtr,
    cpm: avgCpm,
    roas: totalRoas,
    reach: totalReach,
    conversions: totalConversions,
  };
}

const KPI_DEFS = [
  {
    key: "spend" as keyof KpiSummary,
    label: "Gasto Total",
    icon: DollarSign,
    format: formatCurrency,
    color: "text-meta-blue",
    bgColor: "bg-meta-blue/10",
    higherIsBetter: false,
  },
  {
    key: "impressions" as keyof KpiSummary,
    label: "Impressões",
    icon: Eye,
    format: formatNumber,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    higherIsBetter: true,
  },
  {
    key: "clicks" as keyof KpiSummary,
    label: "Cliques",
    icon: MousePointerClick,
    format: formatNumber,
    color: "text-teal-500",
    bgColor: "bg-teal-500/10",
    higherIsBetter: true,
  },
  {
    key: "ctr" as keyof KpiSummary,
    label: "CTR Médio",
    icon: Percent,
    format: (v: number) => formatPercent(v),
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    higherIsBetter: true,
  },
  {
    key: "cpm" as keyof KpiSummary,
    label: "CPM Médio",
    icon: Activity,
    format: formatCurrency,
    color: "text-pink-500",
    bgColor: "bg-pink-500/10",
    higherIsBetter: false,
  },
  {
    key: "roas" as keyof KpiSummary,
    label: "ROAS",
    icon: BarChart2,
    format: formatRoas,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    higherIsBetter: true,
  },
];

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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <KpiSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
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
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  {kpi.label}
                </p>
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
                <div className="mt-1.5 flex items-center gap-1">
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
              ) : (
                <p className="mt-1.5 text-xs text-muted-foreground">Sem comparativo</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
