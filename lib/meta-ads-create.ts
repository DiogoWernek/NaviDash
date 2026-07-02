const META_API = "https://graph.facebook.com/v21.0";

async function metaPost(path: string, token: string, body: Record<string, unknown>) {
  const res = await fetch(`${META_API}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: token }),
  });
  const json = await res.json() as Record<string, unknown>;
  if (!res.ok || json.error) {
    const err = json.error as {
      message?: string; error_user_msg?: string;
      code?: number; error_subcode?: number; fbtrace_id?: string;
    } | undefined;
    const base = err?.error_user_msg ?? err?.message ?? `Meta API error ${res.status}`;
    const detail = [
      err?.code != null ? `code ${err.code}` : null,
      err?.error_subcode != null ? `subcode ${err.error_subcode}` : null,
      err?.fbtrace_id ? `trace ${err.fbtrace_id}` : null,
    ].filter(Boolean).join(", ");
    throw new Error(detail ? `${base} (${detail})` : base);
  }
  return json;
}

async function metaGet(path: string, token: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams({ ...params, access_token: token }).toString();
  const res = await fetch(`${META_API}/${path}?${qs}`);
  const json = await res.json() as Record<string, unknown>;
  if (!res.ok || json.error) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `Meta API error ${res.status}`);
  }
  return json;
}

// Upload image from public URL → returns image_hash
// Downloads the image on our server first, then POSTs as multipart binary to Meta.
// This avoids the "Application does not have the capability" (code 3) error that
// occurs when Meta tries to fetch images via the `url` parameter on its own servers.
export async function uploadAdImage(
  accountId: string,
  token: string,
  imageUrl: string
): Promise<string> {
  // 1) Download image on our server
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error(`Falha ao baixar imagem para upload (${imgRes.status})`);
  const imgBuffer = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
  const ext = contentType.includes("png") ? "png" : "jpg";
  const filename = `upload.${ext}`;

  // 2) Upload binary to Meta via multipart/form-data (requires only ads_management)
  const form = new FormData();
  form.append("access_token", token);
  form.append("filename", new Blob([imgBuffer], { type: contentType }), filename);

  const res = await fetch(`${META_API}/${accountId}/adimages`, {
    method: "POST",
    body: form,
  });

  const json = await res.json() as Record<string, unknown>;
  if (!res.ok || json.error) {
    const err = json.error as {
      message?: string; error_user_msg?: string;
      code?: number; error_subcode?: number; fbtrace_id?: string;
    } | undefined;
    const base = err?.error_user_msg ?? err?.message ?? `Meta API error ${res.status}`;
    const detail = [
      err?.code != null ? `code ${err.code}` : null,
      err?.error_subcode != null ? `subcode ${err.error_subcode}` : null,
      err?.fbtrace_id ? `trace ${err.fbtrace_id}` : null,
    ].filter(Boolean).join(", ");
    throw new Error(detail ? `${base} (${detail})` : base);
  }

  const images = json.images as Record<string, { hash: string }> | undefined;
  if (!images) throw new Error("Resposta inesperada do upload de imagem");
  const hash = Object.values(images)[0]?.hash;
  if (!hash) throw new Error("Hash da imagem não retornado pela Meta");
  return hash;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Upload video from public URL → returns video_id (ainda EM PROCESSAMENTO, ver waitForVideoReady)
// Mesmo motivo do uploadAdImage: baixa no servidor e sobe multipart binário, nunca manda a URL
// direto pra Meta buscar.
export async function uploadAdVideo(
  accountId: string,
  token: string,
  videoUrl: string
): Promise<string> {
  const vidRes = await fetch(videoUrl);
  if (!vidRes.ok) throw new Error(`Falha ao baixar vídeo para upload (${vidRes.status})`);
  const vidBuffer = await vidRes.arrayBuffer();
  const contentType = vidRes.headers.get("content-type") ?? "video/mp4";

  const form = new FormData();
  form.append("access_token", token);
  form.append("source", new Blob([vidBuffer], { type: contentType }), "upload.mp4");

  const res = await fetch(`${META_API}/${accountId}/advideos`, { method: "POST", body: form });
  const json = await res.json() as Record<string, unknown>;
  if (!res.ok || json.error) {
    const err = json.error as {
      message?: string; error_user_msg?: string;
      code?: number; error_subcode?: number; fbtrace_id?: string;
    } | undefined;
    const base = err?.error_user_msg ?? err?.message ?? `Meta API error ${res.status}`;
    const detail = [
      err?.code != null ? `code ${err.code}` : null,
      err?.error_subcode != null ? `subcode ${err.error_subcode}` : null,
      err?.fbtrace_id ? `trace ${err.fbtrace_id}` : null,
    ].filter(Boolean).join(", ");
    throw new Error(detail ? `${base} (${detail})` : base);
  }
  const id = json.id as string | undefined;
  if (!id) throw new Error("video_id não retornado");
  return id;
}

// A Meta processa o vídeo de forma assíncrona — o creative só pode referenciar o
// video_id depois que o status virar "ready". Poll simples com timeout.
export async function waitForVideoReady(
  videoId: string,
  token: string,
  timeoutMs = 180000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await metaGet(videoId, token, { fields: "status" });
    const videoStatus = (res.status as { video_status?: string } | undefined)?.video_status;
    if (videoStatus === "ready") return;
    if (videoStatus === "error") throw new Error("Processamento do vídeo falhou na Meta");
    await sleep(3000);
  }
  throw new Error("Timeout aguardando a Meta processar o vídeo");
}

// Search interests → returns [{id, name}]
// IMPORTANTE: o endpoint de busca da Meta devolve campos extras
// (audience_size_lower_bound, audience_size_upper_bound, path, topic…).
// O spec de targeting REJEITA esses campos ("Normalization does not allow the value
// audience_size_lower_bound"), então mantemos SOMENTE id + name.
export async function searchInterests(
  keyword: string,
  token: string
): Promise<Array<{ id: string; name: string }>> {
  try {
    const res = await metaGet("search", token, { type: "adinterest", q: keyword, limit: "3" });
    const data = (res.data as Array<{ id: string | number; name: string }>) ?? [];
    return data
      .filter((d) => d?.id != null && d?.name != null)
      .map((d) => ({ id: String(d.id), name: String(d.name) }));
  } catch {
    return [];
  }
}

// Países → códigos ISO de 2 letras. Cidades → KEY (a Meta exige key, não nome).
const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  brasil: "BR", brazil: "BR", portugal: "PT", argentina: "AR",
  "estados unidos": "US", "united states": "US", eua: "US", usa: "US",
};

function normalizeCountry(value: string): string | null {
  const v = value.trim();
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  return COUNTRY_NAME_TO_CODE[v.toLowerCase()] ?? null;
}

// Garante um geo_locations 100% válido para a Meta:
// - countries vira código ISO ("Brasil" → "BR")
// - cities por nome são resolvidas para { key } via search (a Meta NÃO aceita nome)
// - se nada sobrar, usa o Brasil como fallback
async function resolveGeoLocations(
  geo: { countries?: string[]; cities?: Array<{ name?: string; key?: string }> } | undefined,
  token: string
): Promise<{ countries?: string[]; cities?: Array<{ key: string }> }> {
  const out: { countries?: string[]; cities?: Array<{ key: string }> } = {};

  const countries = (geo?.countries ?? [])
    .map(normalizeCountry)
    .filter((c): c is string => !!c);

  const cities: Array<{ key: string }> = [];
  for (const city of geo?.cities ?? []) {
    if (city.key) { cities.push({ key: city.key }); continue; }
    if (!city.name) continue;
    try {
      const res = await metaGet("search", token, {
        type: "adgeolocation",
        location_types: '["city"]',
        q: city.name,
        limit: "1",
      });
      const first = (res.data as Array<{ key: string }>)?.[0];
      if (first?.key) cities.push({ key: first.key });
    } catch {
      // cidade não resolvida — ignora, mantém o país
    }
  }

  if (countries.length) out.countries = Array.from(new Set(countries));
  if (cities.length) out.cities = cities;
  if (!out.countries && !out.cities) out.countries = ["BR"];
  return out;
}

// Create campaign → returns campaign_id
// Com CBO: o orçamento fica na campanha e a Meta distribui entre os adsets.
export async function createCampaign(
  accountId: string,
  token: string,
  params: {
    name: string;
    objective: string;
    special_ad_categories: string[];
    daily_budget?: number;
    lifetime_budget?: number;
  }
): Promise<string> {
  const body: Record<string, unknown> = {
    name: params.name,
    objective: params.objective,
    special_ad_categories: params.special_ad_categories,
    status: "PAUSED",
  };

  if (params.daily_budget) {
    body.daily_budget = params.daily_budget;
    body.bid_strategy = "LOWEST_COST_WITHOUT_CAP";
  } else if (params.lifetime_budget) {
    body.lifetime_budget = params.lifetime_budget;
    body.bid_strategy = "LOWEST_COST_WITHOUT_CAP";
  }

  const res = await metaPost(`${accountId}/campaigns`, token, body);
  const id = res.id as string | undefined;
  if (!id) throw new Error("campaign_id não retornado");
  return id;
}

// Create adset → returns adset_id
// CBO: o orçamento está na campanha, então o adset NÃO recebe budget nem bid_strategy.
export async function createAdset(
  accountId: string,
  token: string,
  campaignId: string,
  params: {
    name: string;
    start_time: string;
    end_time?: string | null;
    optimization_goal: string;
    billing_event: string;
    targeting: {
      geo_locations: { countries: string[]; cities?: Array<{ name: string }> };
      age_min: number;
      age_max: number;
      genders: number[];
      resolved_interests: Array<{ id: string; name: string }>;
    };
    publisher_platforms?: string[];
    facebook_positions?: string[];
    instagram_positions?: string[];
    messenger_positions?: string[];
    audience_network_positions?: string[];
    threads_positions?: string[];
    whatsapp_positions?: string[];
    destination_type?: string;
    promoted_object?: { page_id?: string; whatsapp_phone_number?: string };
  }
): Promise<string> {
  // Geo resolvido (cidades → key, países → ISO) e idade dentro dos limites da Meta (13–65)
  const geo_locations = await resolveGeoLocations(params.targeting.geo_locations, token);
  const ageMin = Math.max(13, Math.min(65, Math.round(params.targeting.age_min) || 18));
  const ageMax = Math.max(ageMin, Math.min(65, Math.round(params.targeting.age_max) || 65));

  // genders: [0] ou vazio = todos (a Meta exige OMITIR o campo, nunca enviar [] ou [0])
  const g = params.targeting.genders ?? [];
  const genders = (g.length === 0 || g.includes(0)) ? undefined : g;

  const targeting: Record<string, unknown> = {
    geo_locations,
    age_min: ageMin,
    age_max: ageMax,
    genders,
    // O assistente do Ads Manager sempre grava esse campo (mesmo pra "Todos os
    // dispositivos"); conjuntos criados via API sem ele têm o mesmo comportamento de
    // entrega, mas a tela de edição do Ads Manager pode depender da presença dele pra
    // hidratar corretamente os checkboxes de posicionamento — teste 2026-07-02.
    device_platforms: ["mobile", "desktop"],
  };

  if (params.targeting.resolved_interests.length > 0) {
    // Defesa extra: só id + name no spec, nunca os campos de tamanho de público
    targeting.flexible_spec = [{
      interests: params.targeting.resolved_interests.map((it) => ({ id: String(it.id), name: it.name })),
    }];
  }

  if (params.publisher_platforms) {
    targeting.publisher_platforms = params.publisher_platforms;
    if (params.facebook_positions) targeting.facebook_positions = params.facebook_positions;
    if (params.instagram_positions) targeting.instagram_positions = params.instagram_positions;
    if (params.messenger_positions) targeting.messenger_positions = params.messenger_positions;
    if (params.audience_network_positions) targeting.audience_network_positions = params.audience_network_positions;
    if (params.threads_positions) targeting.threads_positions = params.threads_positions;
    if (params.whatsapp_positions) targeting.whatsapp_positions = params.whatsapp_positions;
  }

  // targeting_automation DENTRO do targeting (subcode 1870227):
  // "defina a sinalização advantage_audience como 1 ou 0 no campo
  //  targeting_automation na especificação de direcionamento"
  // 0 = targeting manual (nosso caso); 1 = Advantage Audience (Meta expande sozinha)
  // Também enviamos no nível do adset para cobrir ambas as interpretações da API.
  targeting.targeting_automation = { advantage_audience: 0 };

  const buildBody = (t: Record<string, unknown>): Record<string, unknown> => {
    const b: Record<string, unknown> = {
      name: params.name,
      campaign_id: campaignId,
      billing_event: params.billing_event,
      optimization_goal: params.optimization_goal,
      targeting: t,
      targeting_automation: { advantage_audience: 0 },
      start_time: params.start_time,
      status: "PAUSED",
    };
    if (params.end_time) b.end_time = params.end_time;
    if (params.destination_type) b.destination_type = params.destination_type;
    if (params.promoted_object?.page_id) {
      // whatsapp_phone_number é o campo que de fato controla pra qual número o clique
      // "Enviar mensagem" abre — o link wa.me no creative NÃO manda nisso pra
      // destination_type=WHATSAPP. Sem esse campo a Meta cai no número padrão já
      // conectado à página, ignorando silenciosamente qualquer número informado
      // (confirmado comparando com um adset feito manualmente no Ads Manager, 2026-07-02).
      b.promoted_object = params.promoted_object.whatsapp_phone_number
        ? { page_id: params.promoted_object.page_id, whatsapp_phone_number: params.promoted_object.whatsapp_phone_number }
        : { page_id: params.promoted_object.page_id };
    }
    return b;
  };

  try {
    const res = await metaPost(`${accountId}/adsets`, token, buildBody(targeting));
    const id = res.id as string | undefined;
    if (!id) throw new Error("adset_id não retornado");
    return id;
  } catch (err) {
    const msg = String(err instanceof Error ? err.message : err);
    // subcode 1870247 = interesse depreciado → retry sem flexible_spec (targeting mais amplo)
    if (msg.includes("1870247") && targeting.flexible_spec) {
      delete targeting.flexible_spec;
      const res = await metaPost(`${accountId}/adsets`, token, buildBody(targeting));
      const id = res.id as string | undefined;
      if (!id) throw new Error("adset_id não retornado");
      return id;
    }
    // subcode 2490408 = optimization_goal incompatível com o objetivo → tenta metas
    // universais em ordem (REACH, depois IMPRESSIONS). Cobre casos onde a Meta
    // muda quais metas são aceitas por objetivo.
    if (msg.includes("2490408")) {
      const fallbacks = ["REACH", "IMPRESSIONS"].filter((g) => g !== params.optimization_goal);
      for (const goal of fallbacks) {
        try {
          const body = buildBody(targeting);
          body.optimization_goal = goal;
          const res = await metaPost(`${accountId}/adsets`, token, body);
          const id = res.id as string | undefined;
          if (id) return id;
        } catch {
          // tenta o próximo fallback
        }
      }
    }
    throw err;
  }
}

export type CreativeMedia =
  | { type: "image"; image_hashes: string[] }   // 1 = imagem única, 2+ = carrossel
  | { type: "video"; video_id: string; thumbnail_url: string };

// Create ad creative → returns creative_id
// media.type="image", 1 hash  → criativo de imagem única
// media.type="image", 2+ hash → criativo em carrossel (child_attachments), copy compartilhada entre os cartões
// media.type="video"          → criativo de vídeo único (video_data)
export async function createAdCreative(
  accountId: string,
  token: string,
  params: {
    name: string;
    page_id: string;
    media: CreativeMedia;
    title: string;
    body: string;
    description: string;
    call_to_action_type: string;
    link: string;
    whatsapp_link?: string;
  }
): Promise<string> {
  const isWhatsApp = params.call_to_action_type === "WHATSAPP_MESSAGE";
  const hasLink = !!params.link?.trim();
  // Engajamento (sem link e sem WhatsApp): post fica linkado à própria Página,
  // sem CTA externo. Isso gera um object_story_id válido para promover no adset.
  const isEngagement = !hasLink && !isWhatsApp;

  // Link efetivo do criativo:
  //  - WhatsApp → link wa.me
  //  - com link  → link informado
  //  - engajamento → URL da própria Página (não exibida como CTA)
  const destLink = isWhatsApp && params.whatsapp_link
    ? params.whatsapp_link
    : hasLink
      ? params.link
      : `https://www.facebook.com/${params.page_id}`;

  // CTA só é enviado quando há um destino real (link ou WhatsApp).
  // Em engajamento, omitir call_to_action → post limpo, só curtir/comentar/compartilhar.
  const callToAction = isEngagement
    ? undefined
    : {
        type: params.call_to_action_type,
        value: isWhatsApp
          ? { app_destination: "WHATSAPP", link: destLink }
          : { link: params.link },
      };

  let objectStorySpec: Record<string, unknown>;

  if (params.media.type === "video") {
    objectStorySpec = {
      page_id: params.page_id,
      video_data: {
        video_id: params.media.video_id,
        image_url: params.media.thumbnail_url,
        title: params.title,
        message: params.body,
        link_description: params.description,
        call_to_action: callToAction,
      },
    };
  } else {
    let linkData: Record<string, unknown>;
    if (params.media.image_hashes.length > 1) {
      // Carrossel
      linkData = {
        link: destLink,
        message: params.body,
        multi_share_optimized: true,
        multi_share_end_card: false,
        child_attachments: params.media.image_hashes.map((hash) => ({
          link: destLink,
          image_hash: hash,
          name: params.title,
          description: params.description,
          call_to_action: callToAction,
        })),
      };
    } else {
      // Imagem única
      linkData = {
        image_hash: params.media.image_hashes[0],
        link: destLink,
        message: params.body,
        name: params.title,
        description: params.description,
        call_to_action: callToAction,
      };
    }
    objectStorySpec = { page_id: params.page_id, link_data: linkData };
  }

  const res = await metaPost(`${accountId}/adcreatives`, token, {
    name: params.name,
    object_story_spec: objectStorySpec,
  });
  const id = res.id as string | undefined;
  if (!id) throw new Error("creative_id não retornado");
  return id;
}

// Fetch the page-post id from a creative (para promover em adsets POST_ENGAGEMENT).
// Tenta effective_object_story_id e object_story_id; faz retry por consistência eventual.
// Retorna "" se não encontrar (o chamador decide o fallback) — não lança.
export async function getCreativeObjectStoryId(creativeId: string, token: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const json = await metaGet(creativeId, token, {
        fields: "effective_object_story_id,object_story_id",
      });
      const storyId = (json.effective_object_story_id ?? json.object_story_id) as string | undefined;
      if (storyId) return storyId;
    } catch {
      // ignora e tenta de novo
    }
    if (attempt < 2) await new Promise((r) => setTimeout(r, 900));
  }
  return "";
}

// Create ad → returns ad_id
export async function createAd(
  accountId: string,
  token: string,
  params: { name: string; adset_id: string; creative_id: string }
): Promise<string> {
  const res = await metaPost(`${accountId}/ads`, token, {
    name: params.name,
    adset_id: params.adset_id,
    creative: { creative_id: params.creative_id },
    status: "PAUSED",
  });
  const id = res.id as string | undefined;
  if (!id) throw new Error("ad_id não retornado");
  return id;
}
