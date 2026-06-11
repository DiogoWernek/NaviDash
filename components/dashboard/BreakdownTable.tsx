"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatNumber,
  formatCurrency,
  formatPercent,
  formatRoas,
} from "@/lib/utils";
import type { DailyInsight, BreakdownItem } from "@/types";

interface BreakdownTableProps {
  insights: DailyInsight[];
  loading?: boolean;
}

function aggregateBreakdown(
  insights: DailyInsight[],
  field: "breakdown_platform" | "breakdown_device" | "breakdown_age_gender"
): BreakdownItem[] {
  const map = new Map<string, BreakdownItem>();

  for (const insight of insights) {
    for (const item of insight[field]) {
      const existing = map.get(item.segment);
      if (existing) {
        existing.impressions += item.impressions;
        existing.clicks += item.clicks;
        existing.spend += item.spend;
      } else {
        map.set(item.segment, { ...item });
      }
    }
  }

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      ctr: item.impressions > 0 ? (item.clicks / item.impressions) * 100 : 0,
      cpm: item.impressions > 0 ? (item.spend / item.impressions) * 1000 : 0,
      roas: item.roas,
    }))
    .sort((a, b) => b.spend - a.spend);
}

function BreakdownRow({
  item,
  rank,
  maxSpend,
}: {
  item: BreakdownItem;
  rank: number;
  maxSpend: number;
}) {
  const spendPct = maxSpend > 0 ? (item.spend / maxSpend) * 100 : 0;

  return (
    <tr className="border-b border-border/50 transition-colors hover:bg-muted/30">
      <td className="py-2.5 pl-4 pr-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xs text-muted-foreground w-4 shrink-0 font-mono">
            {rank}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{item.segment}</p>
            <div className="mt-1 h-1 w-full rounded-full bg-muted">
              <div
                className="h-1 rounded-full bg-meta-blue transition-all"
                style={{ width: `${spendPct}%` }}
              />
            </div>
          </div>
        </div>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="font-mono text-sm">{formatNumber(item.impressions)}</span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="font-mono text-sm">{formatNumber(item.clicks)}</span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="font-mono text-sm font-semibold">{formatCurrency(item.spend)}</span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="font-mono text-sm">{formatPercent(item.ctr)}</span>
      </td>
      <td className="px-3 py-2.5 text-right">
        <span className="font-mono text-sm">{formatCurrency(item.cpm)}</span>
      </td>
      <td className="px-3 py-2.5 pr-4 text-right">
        <span className="font-mono text-sm">{formatRoas(item.roas)}</span>
      </td>
    </tr>
  );
}

function TableHeader() {
  return (
    <thead>
      <tr className="border-b border-border">
        <th className="py-2.5 pl-4 pr-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Segmento
        </th>
        <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Impressões
        </th>
        <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Cliques
        </th>
        <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Gasto
        </th>
        <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          CTR
        </th>
        <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          CPM
        </th>
        <th className="px-3 py-2.5 pr-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          ROAS
        </th>
      </tr>
    </thead>
  );
}

function BreakdownContent({
  items,
  loading,
}: {
  items: BreakdownItem[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
      </div>
    );
  }

  const maxSpend = Math.max(...items.map((i) => i.spend));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px]">
        <TableHeader />
        <tbody>
          {items.map((item, idx) => (
            <BreakdownRow
              key={item.segment}
              item={item}
              rank={idx + 1}
              maxSpend={maxSpend}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BreakdownTable({ insights, loading }: BreakdownTableProps) {
  const platformData = useMemo(
    () => aggregateBreakdown(insights, "breakdown_platform"),
    [insights]
  );
  const deviceData = useMemo(
    () => aggregateBreakdown(insights, "breakdown_device"),
    [insights]
  );
  const ageGenderData = useMemo(
    () => aggregateBreakdown(insights, "breakdown_age_gender"),
    [insights]
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="platform">
          <div className="px-5 pb-3">
            <TabsList className="h-8">
              <TabsTrigger value="platform" className="text-xs h-7 px-3">
                Por Plataforma
              </TabsTrigger>
              <TabsTrigger value="device" className="text-xs h-7 px-3">
                Por Dispositivo
              </TabsTrigger>
              <TabsTrigger value="age_gender" className="text-xs h-7 px-3">
                Idade / Gênero
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="platform">
            <BreakdownContent items={platformData} loading={loading} />
          </TabsContent>
          <TabsContent value="device">
            <BreakdownContent items={deviceData} loading={loading} />
          </TabsContent>
          <TabsContent value="age_gender">
            <BreakdownContent items={ageGenderData} loading={loading} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
