"use client";

import { Users, GraduationCap, DollarSign, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { KommoDashboardData } from "@/lib/kommo";

interface KommoKpiCardsProps {
  data: KommoDashboardData | null;
  loading?: boolean;
}

const cards = (d: KommoDashboardData) => [
  {
    label: "Total de Leads",
    value: formatNumber(d.totalLeads),
    sub: `${d.totalLost} perdidos`,
    icon: Users,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  {
    label: "Matrículas",
    value: formatNumber(d.totalMatriculas),
    sub: d.totalLeads > 0 ? `${((d.totalMatriculas / d.totalLeads) * 100).toFixed(1)}% de conv.` : "—",
    icon: GraduationCap,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    label: "Faturamento (CRM)",
    value: formatCurrency(d.totalRevenue),
    sub: d.totalMatriculas > 0 ? `ticket médio ${formatCurrency(d.totalRevenue / d.totalMatriculas)}` : "—",
    icon: DollarSign,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
  },
  {
    label: "CPA por Matrícula",
    value: d.cpa > 0 ? formatCurrency(d.cpa) : "—",
    sub: "Investimento Meta ÷ matrículas",
    icon: Target,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
  },
];

export function KommoKpiCards({ data, loading }: KommoKpiCardsProps) {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <Skeleton className="h-4 w-28 mb-3" />
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards(data).map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="overflow-hidden hover:shadow-md transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.bg}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
              <p className="font-mono text-2xl font-bold tracking-tight">{card.value}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">{card.sub}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
