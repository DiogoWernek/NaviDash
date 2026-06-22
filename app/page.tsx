"use client";

import { useState, useCallback, useEffect } from "react";
import { Header } from "@/components/dashboard/Header";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { DashboardLineChart } from "@/components/dashboard/LineChart";
import { DashboardBarChart } from "@/components/dashboard/BarChart";
import { BreakdownTable } from "@/components/dashboard/BreakdownTable";
import { CampaignsTable } from "@/components/dashboard/CampaignsTable";
import { GeoMap } from "@/components/dashboard/GeoMap";
import type { BusinessManager, AdAccount, DailyInsight, Campaign, FilterState, GeoData } from "@/types";
import { dateToString } from "@/lib/utils";

const OBJECTIVE_PT: Record<string, string> = {
  CONVERSIONS: "Conversões", BRAND_AWARENESS: "Reconhecimento", APP_INSTALLS: "Instalações",
  LEAD_GENERATION: "Leads", TRAFFIC: "Tráfego", ENGAGEMENT: "Engajamento",
  VIDEO_VIEWS: "Visualizações", MESSAGES: "Mensagens", OUTCOME_ENGAGEMENT: "Engajamento",
  OUTCOME_LEADS: "Leads", OUTCOME_TRAFFIC: "Tráfego", OUTCOME_SALES: "Vendas",
  OUTCOME_APP_PROMOTION: "App", OUTCOME_AWARENESS: "Reconhecimento",
};
const STATUS_PT: Record<string, string> = { ACTIVE: "Ativo", PAUSED: "Pausado", ARCHIVED: "Arquivado" };

function csvResultado(c: Campaign): { value: number | null; label: string } {
  const obj = c.objective.toUpperCase();
  if (obj.includes("LEAD")) return { value: c.leads_form ?? null, label: "Leads" };
  if (obj === "MESSAGES") return { value: c.messaging_conversations ?? null, label: "Conversas" };
  if (obj.includes("TRAFFIC")) return { value: c.clicks ?? null, label: "Cliques LP" };
  if (obj === "APP_INSTALLS" || obj.includes("APP_PROMOTION")) return { value: c.conversions ?? null, label: "Instalações" };
  return { value: c.conversions ?? null, label: "Compras" };
}

function csvCustoResultado(c: Campaign): number | null {
  if (c.cost_per_result) return c.cost_per_result;
  const obj = c.objective.toUpperCase();
  if (obj.includes("LEAD")) return c.cost_per_lead_form ?? null;
  if (obj === "MESSAGES") return c.cost_per_conversation ?? null;
  if (obj.includes("TRAFFIC")) return c.cost_per_landing_page_view ?? null;
  if (obj.includes("VIDEO") || obj.includes("AWARENESS")) return c.cost_per_thruplay ?? null;
  return c.cpa ?? null;
}

function generateCampaignsCsv(campaigns: Campaign[], dateFrom: string, dateTo: string): string {
  const sep = ";";
  const headers = [
    "Nome", "Status", "Objetivo", "Tipo de Resultado", "Resultado", "Custo/Resultado",
    "Orçamento (R$)", "Gasto (R$)", "Impressões", "Cliques", "CTR (%)", "CPM (R$)", "CPA (R$)", "ROAS",
    "Conversas", "Custo/Conversa (R$)", "Leads Form.", "Custo/Lead Form. (R$)",
    "Custo/ThruPlay (R$)", "Custo/Pág. Site (R$)",
    "Reações", "Comentários", "Compartilhamentos", "Seguidores", "Visitas ao Perfil",
    "Última Edição", "Período",
  ];

  function esc(v: string | number | null | undefined): string {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return s.includes(sep) || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  }
  function num(v: number | null | undefined): string {
    if (v === null || v === undefined) return "";
    return String(Math.round(v * 100) / 100).replace(".", ",");
  }
  function int(v: number | null | undefined): string {
    if (v === null || v === undefined) return "";
    return String(Math.round(v));
  }

  const rows = campaigns.map((c) => {
    const { value: resVal, label: resLabel } = csvResultado(c);
    const custo = csvCustoResultado(c);
    const cpa = c.cpa ?? (c.conversions && c.conversions > 0 ? c.spend / c.conversions : null);
    const periodo = `${dateFrom} a ${dateTo}`;
    return [
      esc(c.name),
      esc(STATUS_PT[c.status] ?? c.status),
      esc(OBJECTIVE_PT[c.objective] ?? c.objective),
      esc(resLabel),
      int(resVal),
      num(custo),
      num(c.budget),
      num(c.spend),
      int(c.impressions),
      int(c.clicks),
      num(c.ctr),
      num(c.cpm),
      num(cpa),
      num(c.roas),
      int(c.messaging_conversations),
      num(c.cost_per_conversation),
      int(c.leads_form),
      num(c.cost_per_lead_form),
      num(c.cost_per_thruplay),
      num(c.cost_per_landing_page_view),
      int(c.post_reactions),
      int(c.post_comments),
      int(c.post_shares),
      int(c.follows),
      int(c.profile_visits),
      esc(c.updated_at ? new Date(c.updated_at).toLocaleDateString("pt-BR") : ""),
      esc(periodo),
    ].join(sep);
  });

  return "﻿" + [headers.join(sep), ...rows].join("\r\n");
}

export default function DashboardPage() {
  const [businessManagers, setBusinessManagers] = useState<BusinessManager[]>([]);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [insights, setInsights] = useState<DailyInsight[]>([]);
  const [previousInsights, setPreviousInsights] = useState<DailyInsight[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [geoData, setGeoData] = useState<GeoData | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<FilterState | null>(null);

  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await fetch("/api/accounts");
        const data = await res.json();
        console.log("[page] Contas:", { bms: data.businessManagers?.length, accounts: data.adAccounts?.length });
        setBusinessManagers(data.businessManagers ?? []);
        setAdAccounts(data.adAccounts ?? []);
      } catch (err) {
        console.error("[page] Erro ao carregar contas:", err);
      } finally {
        setLoadingAccounts(false);
      }
    }
    loadAccounts();
  }, []);

  const handleFilterChange = useCallback(async (filters: FilterState) => {
    setCurrentFilters(filters);

    if (filters.selectedAccountIds.length === 0) return;

    const params = new URLSearchParams({
      accountIds: filters.selectedAccountIds.join(","),
      startDate: dateToString(filters.dateRange.from),
      endDate: dateToString(filters.dateRange.to),
    });

    setLoadingInsights(true);
    setLoadingCampaigns(true);
    setLoadingGeo(true);
    setCampaigns([]);

    const [insightsRes, campaignsRes, geoRes] = await Promise.allSettled([
      fetch(`/api/insights?${params}`).then((r) => r.json()),
      fetch(`/api/campaigns?${params}`).then((r) => r.json()),
      fetch(`/api/geo?${params}`).then((r) => r.json()),
    ]);

    if (insightsRes.status === "fulfilled") {
      const data = insightsRes.value;
      setInsights(data.insights ?? []);
      setPreviousInsights(data.previousInsights ?? []);
    } else {
      console.error("[page] Insights error:", insightsRes.reason);
    }
    setLoadingInsights(false);

    if (campaignsRes.status === "fulfilled") {
      setCampaigns(campaignsRes.value.campaigns ?? []);
    } else {
      console.error("[page] Campaigns error:", campaignsRes.reason);
    }
    setLoadingCampaigns(false);

    if (geoRes.status === "fulfilled") {
      setGeoData(geoRes.value);
    } else {
      console.error("[page] Geo error:", geoRes.reason);
    }
    setLoadingGeo(false);
  }, []);

  const handleExportCsv = useCallback(() => {
    if (!campaigns.length || !currentFilters) return;
    const dateFrom = dateToString(currentFilters.dateRange.from);
    const dateTo = dateToString(currentFilters.dateRange.to);
    const csv = generateCampaignsCsv(campaigns, dateFrom, dateTo);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campanhas_${dateFrom}_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [campaigns, currentFilters]);

  async function handleSync() {
    setIsSyncing(true);
    try {
      await fetch("/api/meta/sync", {
        method: "POST",
        headers: { "x-sync-secret": process.env.NEXT_PUBLIC_SYNC_SECRET ?? "" },
      });
      if (currentFilters) await handleFilterChange(currentFilters);
    } catch (err) {
      console.error("Erro ao sincronizar:", err);
    } finally {
      setIsSyncing(false);
    }
  }

  const selectedAccounts = adAccounts.filter((a) =>
    currentFilters?.selectedAccountIds.includes(a.id)
  );

  return (
    <div className="min-h-screen bg-background">
      <Header
        businessManagers={businessManagers}
        adAccounts={adAccounts}
        onFilterChange={handleFilterChange}
        loading={loadingAccounts}
        onSyncClick={handleSync}
        isSyncing={isSyncing}
        onExportCsv={handleExportCsv}
        hasData={campaigns.length > 0}
      />

      <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
        <div className="space-y-6">
          <KpiCards
            insights={insights}
            previousInsights={previousInsights}
            loading={loadingInsights}
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <DashboardLineChart
                insights={insights}
                accounts={selectedAccounts}
                loading={loadingInsights}
              />
            </div>
            <div>
              <DashboardBarChart
                insights={insights}
                accounts={selectedAccounts}
                loading={loadingInsights}
              />
            </div>
          </div>

          <GeoMap geoData={geoData} loading={loadingGeo} />

          <BreakdownTable insights={insights} loading={loadingInsights} />

          <CampaignsTable
            campaigns={campaigns}
            loading={loadingCampaigns}
            currentFilters={currentFilters}
          />
        </div>
      </main>
    </div>
  );
}
