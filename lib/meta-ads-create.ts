const META_API = "https://graph.facebook.com/v21.0";

async function metaPost(path: string, token: string, body: Record<string, unknown>) {
  const res = await fetch(`${META_API}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: token }),
  });
  const json = await res.json() as Record<string, unknown>;
  if (!res.ok || json.error) {
    const err = json.error as { message?: string; error_user_msg?: string } | undefined;
    throw new Error(err?.error_user_msg ?? err?.message ?? `Meta API error ${res.status}`);
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
export async function uploadAdImage(
  accountId: string,
  token: string,
  imageUrl: string
): Promise<string> {
  const res = await metaPost(`${accountId}/adimages`, token, { url: imageUrl });
  const images = res.images as Record<string, { hash: string }> | undefined;
  if (!images) throw new Error("Resposta inesperada do upload de imagem");
  const hash = Object.values(images)[0]?.hash;
  if (!hash) throw new Error("Hash da imagem não retornado pela Meta");
  return hash;
}

// Search interests → returns [{id, name}]
export async function searchInterests(
  keyword: string,
  token: string
): Promise<Array<{ id: string; name: string }>> {
  try {
    const res = await metaGet("search", token, { type: "adinterest", q: keyword, limit: "3" });
    const data = (res.data as Array<{ id: string; name: string }>) ?? [];
    return data;
  } catch {
    return [];
  }
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
  const targeting: Record<string, unknown> = {
    geo_locations: params.targeting.geo_locations,
    age_min: params.targeting.age_min,
    age_max: params.targeting.age_max,
    genders: params.targeting.genders[0] === 0 ? undefined : params.targeting.genders,
  };

  if (params.targeting.resolved_interests.length > 0) {
    targeting.flexible_spec = [{ interests: params.targeting.resolved_interests }];
  }

  if (params.publisher_platforms) {
    targeting.publisher_platforms = params.publisher_platforms;
    if (params.facebook_positions) targeting.facebook_positions = params.facebook_positions;
    if (params.instagram_positions) targeting.instagram_positions = params.instagram_positions;
  }

  const body: Record<string, unknown> = {
    name: params.name,
    campaign_id: campaignId,
    billing_event: params.billing_event,
    optimization_goal: params.optimization_goal,
    targeting,
    start_time: params.start_time,
    status: "PAUSED",
  };

  if (params.end_time) body.end_time = params.end_time;

  // Click-to-WhatsApp: destino + objeto promovido (página com WhatsApp conectado)
  if (params.destination_type) body.destination_type = params.destination_type;
  if (params.promoted_object?.page_id) {
    body.promoted_object = { page_id: params.promoted_object.page_id };
  }

  const res = await metaPost(`${accountId}/adsets`, token, body);
  const id = res.id as string | undefined;
  if (!id) throw new Error("adset_id não retornado");
  return id;
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
