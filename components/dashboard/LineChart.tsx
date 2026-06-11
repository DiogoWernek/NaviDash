"use client";

import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  formatRoas,
  formatDateShort,
  formatMetricValue,
} from "@/lib/utils";
import type { DailyInsight, AdAccount, MetricKey } from "@/types";

interface DashboardLineChartProps {
  insights: DailyInsight[];
  accounts: AdAccount[];
  loading?: boolean;
}

const METRIC_OPTIONS: { value: MetricKey; label: string }[] = [
  { value: "spend", label: "Gasto (R$)" },
  { value: "impressions", label: "Impressões" },
  { value: "clicks", label: "Cliques" },
  { value: "ctr", label: "CTR (%)" },
  { value: "cpm", label: "CPM (R$)" },
  { value: "roas", label: "ROAS" },
];

const ACCOUNT_COLORS = [
  "#1877F2",
  "#8B5CF6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#06B6D4",
];

function formatYAxis(metric: MetricKey, value: number): string {
  switch (metric) {
    case "spend":
    case "cpm":
      return `R$${(value / 1000).toFixed(0)}k`;
    case "impressions":
      return value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value);
    case "clicks":
      return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value);
    case "ctr":
      return `${value.toFixed(1)}%`;
    case "roas":
      return `${value.toFixed(1)}x`;
    default:
      return String(value);
  }
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  metric: MetricKey;
}

function CustomTooltip({ active, payload, label, metric }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2.5 shadow-lg">
      <p className="mb-2 text-xs font-semibold text-muted-foreground">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 py-0.5">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-xs text-muted-foreground truncate max-w-[120px]">
            {entry.name}:
          </span>
          <span className="text-xs font-mono font-semibold">
            {formatMetricValue(metric, entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DashboardLineChart({
  insights,
  accounts,
  loading,
}: DashboardLineChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>("spend");

  const chartData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number | string>>();

    for (const insight of insights) {
      const dateKey = insight.date;
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, { date: formatDateShort(dateKey) });
      }
      const entry = dateMap.get(dateKey)!;
      const current = (entry[insight.account_id] as number) ?? 0;
      entry[insight.account_id] =
        selectedMetric === "ctr" ||
        selectedMetric === "cpm" ||
        selectedMetric === "roas"
          ? insight[selectedMetric]
          : current + insight[selectedMetric];
    }

    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v);
  }, [insights, selectedMetric]);

  const activeAccounts = useMemo(
    () => accounts.filter((a) => insights.some((i) => i.account_id === a.id)),
    [accounts, insights]
  );

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-9 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold">Evolução Diária</CardTitle>
        <Select
          value={selectedMetric}
          onValueChange={(v) => setSelectedMetric(v as MetricKey)}
        >
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METRIC_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="pb-4">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              strokeOpacity={0.5}
            />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v) => formatYAxis(selectedMetric, v)}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <Tooltip
              content={<CustomTooltip metric={selectedMetric} />}
              cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
            />
            {activeAccounts.length > 1 && (
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
              />
            )}
            {activeAccounts.map((account, idx) => (
              <Line
                key={account.id}
                type="monotone"
                dataKey={account.id}
                name={account.name}
                stroke={ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
