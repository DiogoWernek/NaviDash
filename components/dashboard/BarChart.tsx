"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import type { DailyInsight, AdAccount } from "@/types";

interface DashboardBarChartProps {
  insights: DailyInsight[];
  accounts: AdAccount[];
  loading?: boolean;
}

const ACCOUNT_COLORS = [
  "#1877F2",
  "#8B5CF6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#06B6D4",
];

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { name: string } }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground">{payload[0].payload.name}</p>
      <p className="text-sm font-mono font-bold">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
}

export function DashboardBarChart({
  insights,
  accounts,
  loading,
}: DashboardBarChartProps) {
  const chartData = useMemo(() => {
    return accounts
      .map((account, idx) => {
        const accountInsights = insights.filter(
          (i) => i.account_id === account.id
        );
        const totalSpend = accountInsights.reduce((s, i) => s + i.spend, 0);
        return {
          name: account.name,
          spend: totalSpend,
          color: ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length],
        };
      })
      .filter((d) => d.spend > 0)
      .sort((a, b) => b.spend - a.spend);
  }, [insights, accounts]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-52 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length <= 1) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          Gasto por Conta no Período
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              strokeOpacity={0.5}
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: string) =>
                v.length > 18 ? v.slice(0, 16) + "…" : v
              }
            />
            <YAxis
              tickFormatter={(v: number) =>
                v >= 1000 ? `R$${(v / 1000).toFixed(0)}k` : `R$${v}`
              }
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
            <Bar dataKey="spend" radius={[4, 4, 0, 0]} maxBarSize={64}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
