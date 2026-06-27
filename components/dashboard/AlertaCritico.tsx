"use client";

import { useMemo } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { DailyInsight } from "@/types";

interface AlertaCriticoProps {
  insights: DailyInsight[];
  previousInsights: DailyInsight[];
  loading?: boolean;
}

function pct(curr: number, prev: number) {
  if (prev === 0) return null;
  return ((curr - prev) / prev) * 100;
}

export function AlertaCritico({ insights, previousInsights, loading }: AlertaCriticoProps) {
  const alerts = useMemo(() => {
    if (!insights.length || !previousInsights.length) return [];

    const curr = {
      spend: insights.reduce((s, i) => s + i.spend, 0),
      leads: insights.reduce((s, i) => s + (i.leads ?? 0), 0),
    };
    const prev = {
      spend: previousInsights.reduce((s, i) => s + i.spend, 0),
      leads: previousInsights.reduce((s, i) => s + (i.leads ?? 0), 0),
    };

    const currCpl = curr.leads > 0 ? curr.spend / curr.leads : null;
    const prevCpl = prev.leads > 0 ? prev.spend / prev.leads : null;

    const found: string[] = [];

    const spendDelta = pct(curr.spend, prev.spend);
    if (spendDelta !== null && spendDelta > 30) {
      found.push(`Gasto aumentou ${spendDelta.toFixed(0)}% vs período anterior`);
    }

    const leadsDelta = pct(curr.leads, prev.leads);
    if (leadsDelta !== null && leadsDelta < -20 && prev.leads > 5) {
      found.push(`Leads caíram ${Math.abs(leadsDelta).toFixed(0)}% vs período anterior`);
    }

    if (currCpl !== null && prevCpl !== null) {
      const cplDelta = pct(currCpl, prevCpl);
      if (cplDelta !== null && cplDelta > 25) {
        found.push(`CPL subiu ${cplDelta.toFixed(0)}% — custo por lead acima do esperado`);
      }
    }

    return found;
  }, [insights, previousInsights]);

  if (loading) return null;

  const hasAlerts = alerts.length > 0;

  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 ${hasAlerts ? "border-amber-500/30 bg-amber-500/5" : "border-success/30 bg-success/5"}`}>
      {hasAlerts ? (
        <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
      ) : (
        <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
      )}
      <div>
        <p className={`text-sm font-medium ${hasAlerts ? "text-amber-600 dark:text-amber-400" : "text-success"}`}>
          {hasAlerts ? `${alerts.length} alerta${alerts.length > 1 ? "s" : ""} no período` : "Nenhum alerta crítico no período"}
        </p>
        {hasAlerts ? (
          <ul className="mt-1 space-y-0.5">
            {alerts.map((a, i) => (
              <li key={i} className="text-xs text-muted-foreground">• {a}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Métricas dentro da faixa esperada vs período anterior</p>
        )}
      </div>
    </div>
  );
}
