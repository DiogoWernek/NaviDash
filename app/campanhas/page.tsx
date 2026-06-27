"use client";

import { useDashboard } from "@/lib/dashboard-context";
import { useKommo } from "@/lib/use-kommo";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { CampaignsTable } from "@/components/dashboard/CampaignsTable";

export default function CampanhasPage() {
  const {
    insights,
    previousInsights,
    campaigns,
    loadingInsights,
    loadingCampaigns,
    currentFilters,
  } = useDashboard();
  const { data: kommoData } = useKommo();

  return (
    <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
      <div className="space-y-5">
        <KpiCards
          insights={insights}
          previousInsights={previousInsights}
          loading={loadingInsights}
          crmRevenue={kommoData?.totalRevenue}
        />

        <CampaignsTable
          campaigns={campaigns}
          loading={loadingCampaigns}
          currentFilters={currentFilters}
        />
      </div>
    </main>
  );
}
