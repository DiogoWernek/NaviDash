"use client";

import { useMemo } from "react";
import { TrendingUp, TrendingDown, DollarSign, Users, TrendingUp as RevenueIcon, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatNumber, formatVariation } from "@/lib/utils";
import type { DailyInsight } from "@/types";

interface CardDef {
  label: string;
  tooltip?: string;
  value: string;
  prev: number;
  curr: number;
  icon: React.ElementType;
  color: string;
  bg: string;
  higherIsBetter: boolean;
}

interface HeroMetricsProps {
  insights: DailyInsight[];
  previousInsights: DailyInsight[];
  loading?: boolean;
  crmRevenue?: number;
  crmRevenuePrev?: number;
}

function sumInsights(insights: DailyInsight[]) {
  return {
    spend: insights.reduce((s, i) => s + i.spend, 0),
    leads: insights.reduce((s, i) => s + (i.leads ?? 0), 0),
    revenue: insights.reduce((s, i) => s + (i.revenue ?? 0), 0),
  };
}

export function HeroMetrics({ insights, previousInsights, loading, crmRevenue, crmRevenuePrev }: HeroMetricsProps) {
  const current = useMemo(() => sumInsights(insights), [insights]);
  const previous = useMemo(() => sumInsights(previousInsights), [previousInsights]);
  const hasCrm = crmRevenue !== undefined && crmRevenue > 0;

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="overflow-hidden">
            <CardContent className="p-6">
              <Skeleton className="h-4 w-28 mb-4" />
              <Skeleton className="h-10 w-40 mb-2" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards: CardDef[] = [
    {
      label: "Valor Gasto",
      value: formatCurrency(current.spend),
      prev: previous.spend,
      curr: current.spend,
      icon: DollarSign,
      color: "text-meta-blue",
      bg: "bg-meta-blue/10",
      higherIsBetter: false,
    },
    {
      label: "Leads",
      value: formatNumber(current.leads),
      prev: previous.leads,
      curr: current.leads,
      icon: Users,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
      higherIsBetter: true,
    },
    {
      label: hasCrm ? "Faturamento (CRM)" : "Faturamento (Pixel)",
      tooltip: hasCrm
        ? "Faturamento real do CRM Kommo — soma dos negócios ganhos no período."
        : "Valor de compra reportado pelo pixel/Conversions API (action_values.purchase). Para faturamento real do CRM é necessária integração separada.",
      value: formatCurrency(hasCrm ? (crmRevenue ?? 0) : current.revenue),
      prev: hasCrm ? (crmRevenuePrev ?? 0) : previous.revenue,
      curr: hasCrm ? (crmRevenue ?? 0) : current.revenue,
      icon: RevenueIcon,
      color: hasCrm ? "text-cyan-500" : "text-emerald-500",
      bg: hasCrm ? "bg-cyan-500/10" : "bg-emerald-500/10",
      higherIsBetter: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map((card) => {
        const variation = formatVariation(card.curr, card.prev);
        const isPositive = card.higherIsBetter ? variation.positive : !variation.positive;
        const Icon = card.icon;
        return (
          <Card key={card.label} className="overflow-hidden group hover:shadow-md transition-all">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-muted-foreground">{card.label}</span>
                  {card.tooltip && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-64">
                          <p>{card.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.bg}`}>
                  <Icon className={`h-4.5 w-4.5 ${card.color}`} />
                </div>
              </div>
              <p className="font-mono text-3xl font-bold tracking-tight">{card.value}</p>
              {variation.value !== "—" ? (
                <div className="mt-2 flex items-center gap-1">
                  {isPositive ? (
                    <TrendingUp className="h-3.5 w-3.5 text-success" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5 text-danger" />
                  )}
                  <span className={`text-sm font-medium ${isPositive ? "text-success" : "text-danger"}`}>
                    {variation.value}
                  </span>
                  <span className="text-xs text-muted-foreground">vs período anterior</span>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Sem período anterior</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
