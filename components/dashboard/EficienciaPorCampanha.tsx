"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatNumber } from "@/lib/utils";
import type { Campaign } from "@/types";

interface EficienciaPorCampanhaProps {
  campaigns: Campaign[];
  loading?: boolean;
}

export function EficienciaPorCampanha({ campaigns, loading }: EficienciaPorCampanhaProps) {
  const top5 = useMemo(() => {
    return campaigns
      .filter((c) => {
        const leads = c.leads_total ?? c.leads_form ?? 0;
        return leads > 0 && c.spend > 0;
      })
      .map((c) => {
        const leads = c.leads_total ?? c.leads_form ?? 0;
        const cpl = c.spend / leads;
        return { ...c, _leads: leads, _cpl: cpl };
      })
      .sort((a, b) => a._cpl - b._cpl)
      .slice(0, 5);
  }, [campaigns]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Eficiência por Campanha — Top 5 Menor CPL</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : top5.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma campanha com leads no período</p>
        ) : (
          <div className="space-y-2">
            {top5.map((c, idx) => (
              <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2 hover:bg-muted/40 transition-colors">
                <span className="font-mono text-xs font-bold text-muted-foreground w-5 shrink-0">#{idx + 1}</span>
                <span className="flex-1 text-xs font-medium truncate" title={c.name}>{c.name}</span>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {c.status === "ACTIVE" ? "Ativa" : "Pausada"}
                </Badge>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <p className="font-mono text-xs font-bold text-meta-blue">{formatCurrency(c._cpl)}</p>
                    <p className="text-[10px] text-muted-foreground">CPL</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs font-semibold">{formatNumber(c._leads)}</p>
                    <p className="text-[10px] text-muted-foreground">Leads</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-xs text-muted-foreground">{formatCurrency(c.spend)}</p>
                    <p className="text-[10px] text-muted-foreground">Gasto</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
