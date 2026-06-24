import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  uploadAdImage,
  searchInterests,
  createCampaign,
  createAdset,
  createAdCreative,
  createAd,
} from "@/lib/meta-ads-create";
import type { AdPlan, ExecuteResult, ExecuteAdsetResult, AgentFormData } from "@/types";

const USE_MOCK = process.env.MOCK_AGENT === "true";

const CAMPAIGN_GROUP = "__campaign__";

interface ExecuteBody {
  plan: AdPlan;
  accountIds: string[];
  formData?: AgentFormData;
  runId?: string;
}

export async function POST(req: NextRequest) {
  const body = await req.json() as ExecuteBody;
  const { plan, accountIds, formData } = body;
  let runId = body.runId ?? null;

  if (!plan || !accountIds?.length || !plan.adsets?.length) {
    return new Response(
      JSON.stringify({ error: "Dados incompletos" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const send = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      let result: ExecuteResult | null = null;
      let overallStatus: "success" | "failed" | "partial" = "success";
      let errorLog: string | undefined;

      try {
        if (USE_MOCK) {
          const accountName = "Conta Simulada";
          send({ type: "step", step: "create_campaign", status: "start", label: "Criando campanha...", group_id: CAMPAIGN_GROUP });
          await new Promise((r) => setTimeout(r, 900));
          const campaignId = "100000000000001";
          send({ type: "step", step: "create_campaign", status: "done", label: "Campanha criada", value: campaignId, group_id: CAMPAIGN_GROUP });

          const adsetResults: ExecuteAdsetResult[] = [];

          for (let i = 0; i < plan.adsets.length; i++) {
            const adset = plan.adsets[i];
            const gid = String(i);
            send({ type: "group_start", group_id: gid, group_name: adset.name });

            const steps = [
              { step: "upload_image", label: `Enviando ${adset.creative.image_urls.length} imagem(ns)...`, doneLabel: `${adset.creative.image_urls.length} imagem(ns) enviada(s)`, value: `mock_hash_${i}` },
              { step: "search_interests", label: "Buscando interesses...", doneLabel: "Interesses encontrados" },
              { step: "create_adset", label: "Criando conjunto...", doneLabel: "Conjunto criado", value: `20000000000${i}` },
              { step: "create_creative", label: adset.creative.image_urls.length > 1 ? "Criando carrossel..." : "Criando criativo...", doneLabel: "Criativo criado", value: `30000000000${i}` },
              { step: "create_ad", label: "Criando anúncio...", doneLabel: "Anúncio criado (pausado)", value: `40000000000${i}` },
            ];

            for (const s of steps) {
              send({ type: "step", step: s.step, status: "start", label: s.label, group_id: gid });
              await new Promise((r) => setTimeout(r, 600 + Math.random() * 500));
              send({ type: "step", step: s.step, status: "done", label: s.doneLabel, value: s.value, group_id: gid });
            }

            adsetResults.push({ name: adset.name, adset_id: `20000000000${i}`, creative_id: `30000000000${i}`, ad_id: `40000000000${i}` });
          }

          result = { account_id: accountIds[0], account_name: accountName, campaign_id: campaignId, adsets: adsetResults };
          send({ type: "done", result });
          controller.close();
          return;
        }

        // === REAL EXECUTION ===

        // Conta única (modelo novo: 1 conta por campanha)
        const { data: accounts, error: accErr } = await supabaseAdmin
          .from("ad_accounts")
          .select("id, name, meta_account_id, access_token")
          .eq("id", accountIds[0])
          .limit(1);

        if (accErr || !accounts?.length) throw new Error("Conta não encontrada");

        const account = accounts[0];
        const { id: dbId, name: accountName, meta_account_id: metaAccountId, access_token: token } = account;

        // Registra a execução no histórico (server-side — o client não tem service role)
        if (formData && !runId) {
          try {
            const { data: run } = await supabaseAdmin
              .from("agent_runs")
              .insert({
                account_id: formData.account_ids[0] ?? dbId ?? null,
                form_data: formData,
                image_url: formData.audiences[0]?.images[0]?.url ?? null,
                status: "running",
                started_at: new Date().toISOString(),
              })
              .select("id")
              .single();
            runId = run?.id ?? null;
          } catch {
            // logging não-fatal
          }
        }

        // 1) Campanha (CBO) — criada uma vez
        send({ type: "step", step: "create_campaign", status: "start", label: "Criando campanha...", group_id: CAMPAIGN_GROUP });
        const campaignId = await createCampaign(metaAccountId, token, {
          name: plan.campaign.name,
          objective: plan.campaign.objective,
          special_ad_categories: plan.campaign.special_ad_categories ?? [],
          daily_budget: plan.campaign.daily_budget ?? undefined,
          lifetime_budget: plan.campaign.lifetime_budget ?? undefined,
        });
        send({ type: "step", step: "create_campaign", status: "done", label: "Campanha criada", value: campaignId, group_id: CAMPAIGN_GROUP });

        const adsetResults: ExecuteAdsetResult[] = [];

        // 2) Um adset + criativo + anúncio por público
        for (let i = 0; i < plan.adsets.length; i++) {
          const adset = plan.adsets[i];
          const gid = String(i);
          send({ type: "group_start", group_id: gid, group_name: adset.name });

          let currentStep = "upload_image";
          try {
            // Upload das imagens desse público → hashes
            send({ type: "step", step: "upload_image", status: "start", label: `Enviando ${adset.creative.image_urls.length} imagem(ns) para a Meta...`, group_id: gid });
            const imageHashes: string[] = [];
            for (const url of adset.creative.image_urls) {
              imageHashes.push(await uploadAdImage(metaAccountId, token, url));
            }
            if (imageHashes.length === 0) throw new Error("Nenhuma imagem para este público");
            send({ type: "step", step: "upload_image", status: "done", label: `${imageHashes.length} imagem(ns) enviada(s)`, value: imageHashes[0], group_id: gid });

            // Interesses
            send({ type: "step", step: "search_interests", status: "start", label: "Buscando interesses de público...", group_id: gid });
            const resolvedInterests: Array<{ id: string; name: string }> = [];
            for (const interest of adset.targeting.interests ?? []) {
              const found = await searchInterests(interest.keyword, token);
              if (found.length > 0) resolvedInterests.push(found[0]);
            }
            send({ type: "step", step: "search_interests", status: "done", label: `${resolvedInterests.length} interesses encontrados`, group_id: gid });

            // Adset (sem budget — CBO na campanha)
            currentStep = "create_adset";
            send({ type: "step", step: "create_adset", status: "start", label: "Criando conjunto de anúncios...", group_id: gid });
            const adsetId = await createAdset(metaAccountId, token, campaignId, {
              name: adset.name,
              start_time: adset.start_time,
              end_time: adset.end_time ?? undefined,
              optimization_goal: adset.optimization_goal,
              billing_event: adset.billing_event,
              targeting: {
                geo_locations: adset.targeting.geo_locations,
                age_min: adset.targeting.age_min,
                age_max: adset.targeting.age_max,
                genders: adset.targeting.genders,
                resolved_interests: resolvedInterests,
              },
              publisher_platforms: adset.targeting.publisher_platforms,
              facebook_positions: adset.targeting.facebook_positions,
              instagram_positions: adset.targeting.instagram_positions,
              destination_type: adset.destination_type,
              promoted_object: adset.promoted_object,
            });
            send({ type: "step", step: "create_adset", status: "done", label: "Conjunto de anúncios criado", value: adsetId, group_id: gid });

            // Criativo (carrossel se 2+ imagens)
            const isCarousel = imageHashes.length > 1;
            currentStep = "create_creative";
            send({ type: "step", step: "create_creative", status: "start", label: isCarousel ? "Criando criativo em carrossel..." : "Criando criativo do anúncio...", group_id: gid });
            const creativeId = await createAdCreative(metaAccountId, token, {
              name: adset.creative.name,
              page_id: adset.creative.page_id,
              image_hashes: imageHashes,
              title: adset.creative.title,
              body: adset.creative.body,
              description: adset.creative.description,
              call_to_action_type: adset.creative.call_to_action_type,
              link: adset.creative.link,
              whatsapp_link: adset.creative.whatsapp_link,
            });
            send({ type: "step", step: "create_creative", status: "done", label: isCarousel ? "Carrossel criado" : "Criativo criado", value: creativeId, group_id: gid });

            // Anúncio
            currentStep = "create_ad";
            send({ type: "step", step: "create_ad", status: "start", label: "Criando anúncio...", group_id: gid });
            const adId = await createAd(metaAccountId, token, {
              name: adset.name,
              adset_id: adsetId,
              creative_id: creativeId,
            });
            send({ type: "step", step: "create_ad", status: "done", label: "Anúncio criado (pausado)", value: adId, group_id: gid });

            adsetResults.push({ name: adset.name, adset_id: adsetId, creative_id: creativeId, ad_id: adId });
          } catch (adsetErr) {
            const errMsg = String(adsetErr instanceof Error ? adsetErr.message : adsetErr);
            overallStatus = adsetResults.length > 0 ? "partial" : "failed";
            errorLog = (errorLog ? errorLog + "\n" : "") + `[${adset.name}] ${errMsg}`;
            send({ type: "step", step: currentStep, status: "error", label: `Erro: ${errMsg}`, group_id: gid });
          }
        }

        result = { account_id: dbId, account_name: accountName, campaign_id: campaignId, adsets: adsetResults };
        if (adsetResults.length === 0) {
          // A campanha foi criada, mas nenhum conjunto/anúncio subiu — não reportar como sucesso
          send({
            type: "error",
            message:
              (errorLog ? `${errorLog}\n\n` : "") +
              `A campanha (${campaignId}) foi criada, mas nenhum conjunto de anúncios pôde ser criado. Verifique o objetivo e as configurações acima.`,
            result,
          });
        } else {
          send({ type: "done", result });
        }
      } catch (err) {
        overallStatus = "failed";
        errorLog = String(err instanceof Error ? err.message : err);
        send({ type: "error", message: errorLog });
      } finally {
        if (runId) {
          const firstAdset = result?.adsets[0];
          await supabaseAdmin
            .from("agent_runs")
            .update({
              status: overallStatus,
              error_log: errorLog ?? null,
              meta_campaign_id: result?.campaign_id ?? null,
              meta_adset_id: firstAdset?.adset_id ?? null,
              meta_creative_id: firstAdset?.creative_id ?? null,
              meta_ad_id: firstAdset?.ad_id ?? null,
              finished_at: new Date().toISOString(),
            })
            .eq("id", runId);
        }
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
