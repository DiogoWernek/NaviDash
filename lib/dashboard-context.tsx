"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { BusinessManager, AdAccount, DailyInsight, Campaign, FilterState, GeoData } from "@/types";
import { dateToString } from "@/lib/utils";

interface DashboardContextValue {
  businessManagers: BusinessManager[];
  adAccounts: AdAccount[];
  loadingAccounts: boolean;
  insights: DailyInsight[];
  previousInsights: DailyInsight[];
  campaigns: Campaign[];
  geoData: GeoData | null;
  loadingInsights: boolean;
  loadingCampaigns: boolean;
  loadingGeo: boolean;
  currentFilters: FilterState | null;
  isSyncing: boolean;
  handleFilterChange: (filters: FilterState) => Promise<void>;
  handleSync: () => Promise<void>;
  handleExportCsv: () => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

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
  if (obj.includes("LEAD")) return { value: c.leads_total ?? c.leads_form ?? null, label: "Leads" };
  if (obj === "MESSAGES") return { value: c.messaging_conversations ?? null, label: "Conversas" };
  if (obj.includes("TRAFFIC")) return { value: c.clicks ?? null, label: "Cliques LP" };
  if (obj === "APP_INSTALLS" || obj.includes("APP_PROMOTION")) return { value: c.conversions ?? null, label: "Instalações" };
  return { value: c.conversions ?? null, label: "Compras" };
}

function csvCustoResultado(c: Campaign): number | null {
  if (c.cost_per_result) return c.cost_per_result;
  const obj = c.objective.toUpperCase();
  if (obj.includes("LEAD")) return c.cost_per_lead_form ?? (c.leads_total && c.leads_total > 0 ? c.spend / c.leads_total : null);
  if (obj === "MESSAGES") return c.cost_per_conversation ?? null;
  if (obj.includes("TRAFFIC")) return c.cost_per_landing_page_view ?? null;
  if (obj.includes("VIDEO") || obj.includes("AWARENESS")) return c.cost_per_thruplay ?? null;
  return c.cpa ?? null;
}

function generateCampaignsCsv(campaigns: Campaign[], dateFrom: string, dateTo: string): string {
  const sep = ";";
  const headers = [
    "Nome", "Status", "Objetivo", "Tipo de Resultado", "Resultado", "Custo/Resultado",
    "Orçamento (R$)", "Gasto (R$)", "Leads (Total)", "Leads (Form.)", "CPL (R$)",
    "Impressões", "Cliques", "CTR (%)", "CPM (R$)", "CPA (R$)", "ROAS",
    "Conversas", "Custo/Conversa (R$)", "Custo/ThruPlay (R$)", "Custo/Pág. Site (R$)",
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
    const leadsTotal = c.leads_total;
    const cpl = leadsTotal && leadsTotal > 0 ? c.spend / leadsTotal : null;
    const periodo = `${dateFrom} a ${dateTo}`;
    return [
      esc(c.name), esc(STATUS_PT[c.status] ?? c.status), esc(OBJECTIVE_PT[c.objective] ?? c.objective),
      esc(resLabel), int(resVal), num(custo), num(c.budget),
      num(c.spend), int(leadsTotal), int(c.leads_form), num(cpl),
      int(c.impressions), int(c.clicks), num(c.ctr), num(c.cpm), num(cpa), num(c.roas),
      int(c.messaging_conversations), num(c.cost_per_conversation),
      num(c.cost_per_thruplay), num(c.cost_per_landing_page_view),
      int(c.post_reactions), int(c.post_comments), int(c.post_shares), int(c.follows), int(c.profile_visits),
      esc(c.updated_at ? new Date(c.updated_at).toLocaleDateString("pt-BR") : ""),
      esc(periodo),
    ].join(sep);
  });

  return "﻿" + [headers.join(sep), ...rows].join("\r\n");
}

export function DashboardProvider({ children }: { children: ReactNode }) {
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
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => {
        setBusinessManagers(data.businessManagers ?? []);
        setAdAccounts(data.adAccounts ?? []);
      })
      .catch(console.error)
      .finally(() => setLoadingAccounts(false));
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
      setInsights(insightsRes.value.insights ?? []);
      setPreviousInsights(insightsRes.value.previousInsights ?? []);
    }
    setLoadingInsights(false);

    if (campaignsRes.status === "fulfilled") {
      setCampaigns(campaignsRes.value.campaigns ?? []);
    }
    setLoadingCampaigns(false);

    if (geoRes.status === "fulfilled") {
      setGeoData(geoRes.value);
    }
    setLoadingGeo(false);
  }, []);

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await fetch("/api/meta/sync", {
        method: "POST",
        headers: { "x-sync-secret": process.env.NEXT_PUBLIC_SYNC_SECRET ?? "" },
      });
      if (currentFilters) await handleFilterChange(currentFilters);
    } catch (err) {
      console.error("[sync] Error:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [currentFilters, handleFilterChange]);

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

  return (
    <DashboardContext.Provider
      value={{
        businessManagers, adAccounts, loadingAccounts,
        insights, previousInsights, campaigns,
        geoData, loadingInsights, loadingCampaigns, loadingGeo,
        currentFilters, isSyncing,
        handleFilterChange, handleSync, handleExportCsv,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
