"use client";

import { useState, useCallback, useEffect } from "react";
import { Header } from "@/components/dashboard/Header";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { DashboardLineChart } from "@/components/dashboard/LineChart";
import { DashboardBarChart } from "@/components/dashboard/BarChart";
import { BreakdownTable } from "@/components/dashboard/BreakdownTable";
import { CampaignsTable } from "@/components/dashboard/CampaignsTable";
import type {
  BusinessManager,
  AdAccount,
  DailyInsight,
  Campaign,
  FilterState,
} from "@/types";
import { dateToString } from "@/lib/utils";

export default function DashboardPage() {
  const [businessManagers, setBusinessManagers] = useState<BusinessManager[]>([]);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [insights, setInsights] = useState<DailyInsight[]>([]);
  const [previousInsights, setPreviousInsights] = useState<DailyInsight[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentFilters, setCurrentFilters] = useState<FilterState | null>(null);

  useEffect(() => {
    async function loadAccounts() {
      try {
        console.log("[page] Buscando contas...");
        const res = await fetch("/api/accounts");
        const data = await res.json();
        console.log("[page] Contas recebidas:", {
          bms: data.businessManagers?.length,
          accounts: data.adAccounts?.length,
        });
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
    console.log("[page] handleFilterChange chamado:", {
      bm: filters.selectedBmId,
      accounts: filters.selectedAccountIds,
      from: dateToString(filters.dateRange.from),
      to: dateToString(filters.dateRange.to),
    });

    setCurrentFilters(filters);

    if (filters.selectedAccountIds.length === 0) {
      console.warn("[page] Nenhuma conta selecionada, abortando fetch de insights.");
      return;
    }

    setLoadingInsights(true);
    try {
      const params = new URLSearchParams({
        accountIds: filters.selectedAccountIds.join(","),
        startDate: dateToString(filters.dateRange.from),
        endDate: dateToString(filters.dateRange.to),
      });

      console.log("[page] Buscando insights:", params.toString());
      const res = await fetch(`/api/insights?${params.toString()}`);
      const data = await res.json();
      console.log("[page] Insights recebidos:", {
        insights: data.insights?.length,
        previous: data.previousInsights?.length,
        campaigns: data.campaigns?.length,
      });

      setInsights(data.insights ?? []);
      setPreviousInsights(data.previousInsights ?? []);
      setCampaigns(data.campaigns ?? []);
    } catch (err) {
      console.error("[page] Erro ao carregar insights:", err);
    } finally {
      setLoadingInsights(false);
    }
  }, []);

  async function handleSync() {
    setIsSyncing(true);
    try {
      await fetch("/api/meta/sync", {
        method: "POST",
        headers: { "x-sync-secret": process.env.NEXT_PUBLIC_SYNC_SECRET ?? "" },
      });
      if (currentFilters) {
        await handleFilterChange(currentFilters);
      }
    } catch (err) {
      console.error("Erro ao sincronizar:", err);
    } finally {
      setIsSyncing(false);
    }
  }

  const selectedAccounts = adAccounts.filter((a) =>
    currentFilters?.selectedAccountIds.includes(a.id)
  );

  const filteredCampaigns = campaigns.filter((c) =>
    currentFilters?.selectedAccountIds.includes(c.account_id)
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
      />

      <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
        <div className="space-y-6">
          {/* KPI Cards */}
          <KpiCards
            insights={insights}
            previousInsights={previousInsights}
            loading={loadingInsights}
          />

          {/* Charts row */}
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

          {/* Breakdown Table */}
          <BreakdownTable insights={insights} loading={loadingInsights} />

          {/* Campaigns Table */}
          <CampaignsTable
            campaigns={filteredCampaigns}
            loading={loadingInsights}
          />
        </div>
      </main>
    </div>
  );
}
