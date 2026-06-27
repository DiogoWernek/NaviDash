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
    destination_type?: string;
    promoted_object?: { page_id?: string };
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
    if (params.promoted_object?.page_id) b.promoted_object = { page_id: params.promoted_object.page_id };
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
    throw err;
  }
}

// Create ad creative → returns creative_id
// 1 imagem  → criativo de imagem única
// 2+ imagens → criativo em carrossel (child_attachments), copy compartilhada entre os cartões
export async function createAdCreative(
  accountId: string,
  token: string,
  params: {
    name: string;
    page_id: string;
    image_hashes: string[];
    title: string;
    body: string;
    description: string;
    call_to_action_type: string;
    link: string;
    whatsapp_link?: string;
  }
): Promise<string> {
  // Click-to-WhatsApp: o CTA aponta para o WhatsApp e o link do criativo vira o link wa.me
  const isWhatsApp = params.call_to_action_type === "WHATSAPP_MESSAGE";
  const destLink = isWhatsApp && params.whatsapp_link ? params.whatsapp_link : params.link;
  const callToAction = {
    type: params.call_to_action_type,
    value: isWhatsApp
      ? { app_destination: "WHATSAPP", link: destLink }
      : { link: params.link },
  };

  let linkData: Record<string, unknown>;

  if (params.image_hashes.length > 1) {
    // Carrossel
    linkData = {
      link: destLink,
      message: params.body,
      multi_share_optimized: true,
      multi_share_end_card: false,
      child_attachments: params.image_hashes.map((hash) => ({
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
      image_hash: params.image_hashes[0],
      link: destLink,
      message: params.body,
      name: params.title,
      description: params.description,
      call_to_action: callToAction,
    };
  }

  const res = await metaPost(`${accountId}/adcreatives`, token, {
    name: params.name,
    object_story_spec: {
      page_id: params.page_id,
      link_data: linkData,
    },
  });
  const id = res.id as string | undefined;
  if (!id) throw new Error("creative_id não retornado");
  return id;
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
