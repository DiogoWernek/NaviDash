"use client";

import { useKommo } from "@/lib/use-kommo";
import { KommoKpiCards } from "@/components/dashboard/KommoKpiCards";
import { KommoFunil } from "@/components/dashboard/KommoFunil";
import { KommoOrigem } from "@/components/dashboard/KommoOrigem";
import { KommoCursos } from "@/components/dashboard/KommoCursos";
import { KommoLeadsPorDia } from "@/components/dashboard/KommoLeadsPorDia";

export default function CrmPage() {
  const { data, loading, error } = useKommo();

  return (
    <main className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6">
      <div className="space-y-5">
        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-600 dark:text-rose-400">
            Erro ao carregar dados do Kommo: {error}
          </div>
        )}

        {/* KPIs */}
        <KommoKpiCards data={data} loading={loading} />

        {/* Leads por dia */}
        <KommoLeadsPorDia data={data} loading={loading} />

        {/* Funil + Origem side by side */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <KommoFunil data={data} loading={loading} />
          <KommoOrigem data={data} loading={loading} />
        </div>

        {/* Cursos */}
        <KommoCursos data={data} loading={loading} />
      </div>
    </main>
  );
}
