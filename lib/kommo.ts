function getToken(): string {
  return process.env.KOMMO_ACCESS_TOKEN ?? "";
}

function getBaseUrl(): string {
  const domain = process.env.KOMMO_DOMAIN;
  if (!domain || domain.includes("<")) throw new Error("KOMMO_DOMAIN não configurado");
  return `https://${domain}/api/v4`;
}

const STATUS_WON = 142;
const STATUS_LOST = 143;

// ——— Raw API types ———
interface KommoLeadRaw {
  id: number;
  name: string;
  price: number;
  status_id: number;
  pipeline_id: number;
  created_at: number;
  closed_at: number | null;
  custom_fields_values: Array<{
    field_id: number;
    field_name: string;
    values: Array<{ value: string | number }>;
  }> | null;
  _embedded?: { tags?: Array<{ id: number; name: string }> };
}

interface KommoStatusRaw {
  id: number;
  name: string;
}

interface KommoPipelineRaw {
  id: number;
  name: string;
  _embedded: { statuses: KommoStatusRaw[] };
}

// ——— Public types ———
export interface KommoDashboardData {
  totalLeads: number;
  totalMatriculas: number;
  totalLost: number;
  totalRevenue: number;
  cpa: number;
  byStage: Array<{ stage: string; count: number; value: number }>;
  byCourse: Array<{ course: string; leads: number; matriculas: number; revenue: number; cpa: number }>;
  bySource: Array<{ source: string; count: number; matriculas: number }>;
  byDay: Array<{ date: string; leads: number; matriculas: number }>;
}

// ——— Field name heuristics ———
const SOURCE_FIELDS = ["origem", "fonte", "utm_source", "utmsource", "source", "canal"];
const COURSE_FIELDS = ["curso", "produto", "course", "product", "oferta", "programa"];

function getField(lead: KommoLeadRaw, names: string[], fieldId?: number): string {
  const fields = lead.custom_fields_values ?? [];
  if (fieldId) {
    const f = fields.find((f) => f.field_id === fieldId);
    if (f?.values[0]?.value) return String(f.values[0].value);
  }
  for (const name of names) {
    const f = fields.find((f) => f.field_name.toLowerCase().includes(name));
    if (f?.values[0]?.value) return String(f.values[0].value);
  }
  return "";
}

// ——— Paginated fetch ———
async function fetchAll<T>(url: string, embeddedKey: string): Promise<T[]> {
  const items: T[] = [];
  let next: string | undefined = url;
  while (next) {
    const res: Response = await fetch(next, { headers: { Authorization: `Bearer ${getToken()}` } });
    if (res.status === 204) break;
    if (!res.ok) throw new Error(`Kommo ${res.status}: ${await res.text()}`);
    interface KommoPage {
      _embedded?: Record<string, unknown[]>;
      _links?: { next?: { href?: string } };
    }
    const json = await res.json() as KommoPage;
    const page: T[] = (json._embedded?.[embeddedKey] as T[] | undefined) ?? [];
    items.push(...page);
    next = json._links?.next?.href ?? undefined;
    if (next) await new Promise((r) => setTimeout(r, 50));
  }
  return items;
}

export async function fetchKommoLeads(from: string, to: string): Promise<KommoLeadRaw[]> {
  const f = Math.floor(new Date(from + "T00:00:00").getTime() / 1000);
  const t = Math.floor(new Date(to + "T23:59:59").getTime() / 1000);
  const base = getBaseUrl();
  const url = `${base}/leads?filter[created_at][from]=${f}&filter[created_at][to]=${t}&limit=250&with=tags&order[created_at]=asc`;
  return fetchAll<KommoLeadRaw>(url, "leads");
}

export async function fetchKommoPipelines(): Promise<KommoPipelineRaw[]> {
  return fetchAll<KommoPipelineRaw>(`${getBaseUrl()}/leads/pipelines?limit=250`, "pipelines");
}

// ——— Aggregation ———
export function buildDashboard(
  rawLeads: KommoLeadRaw[],
  pipelines: KommoPipelineRaw[],
  metaSpend: number,
  courseFieldId?: number,
  sourceFieldId?: number,
  defaultTicketPrice = 0
): KommoDashboardData {
  const statusMap = new Map<number, { statusName: string }>();
  for (const p of pipelines) {
    for (const s of p._embedded?.statuses ?? []) {
      const name = s.id === STATUS_WON ? "Ganho" : s.id === STATUS_LOST ? "Perdido" : s.name;
      statusMap.set(s.id, { statusName: name });
    }
  }

  const leads = rawLeads.map((raw) => {
    const tags = raw._embedded?.tags?.map((t) => t.name) ?? [];
    let source = getField(raw, SOURCE_FIELDS, sourceFieldId);
    if (!source && tags.length > 0) source = tags[0];
    if (!source) source = "Não informado";
    let course = getField(raw, COURSE_FIELDS, courseFieldId);
    if (!course) course = "Não informado";
    return {
      id: raw.id,
      statusId: raw.status_id,
      statusName: statusMap.get(raw.status_id)?.statusName ?? "Desconhecido",
      isWon: raw.status_id === STATUS_WON,
      isLost: raw.status_id === STATUS_LOST,
      price: (raw.price ?? 0) > 0 ? raw.price : defaultTicketPrice,
      createdAt: new Date(raw.created_at * 1000),
      course,
      source,
    };
  });

  const totalLeads = leads.length;
  const wonLeads = leads.filter((l) => l.isWon);
  const totalMatriculas = wonLeads.length;
  const totalLost = leads.filter((l) => l.isLost).length;
  const totalRevenue = wonLeads.reduce((s, l) => s + l.price, 0);
  const cpa = totalMatriculas > 0 ? metaSpend / totalMatriculas : 0;

  // By stage — Won first, Lost last
  const stageMap = new Map<string, { count: number; value: number }>();
  for (const lead of leads) {
    const e = stageMap.get(lead.statusName) ?? { count: 0, value: 0 };
    e.count++;
    e.value += lead.price;
    stageMap.set(lead.statusName, e);
  }
  const byStage = Array.from(stageMap.entries())
    .map(([stage, d]) => ({ stage, ...d }))
    .sort((a, b) => {
      const order = (s: string) => (s === "Ganho" ? 0 : s === "Perdido" ? 99 : 50);
      return order(a.stage) - order(b.stage);
    });

  // By course
  const courseMap = new Map<string, { leads: number; matriculas: number; revenue: number }>();
  for (const lead of leads) {
    const e = courseMap.get(lead.course) ?? { leads: 0, matriculas: 0, revenue: 0 };
    e.leads++;
    if (lead.isWon) { e.matriculas++; e.revenue += lead.price; }
    courseMap.set(lead.course, e);
  }
  const byCourse = Array.from(courseMap.entries())
    .map(([course, d]) => ({
      course,
      ...d,
      cpa:
        d.matriculas > 0 && metaSpend > 0
          ? (metaSpend * (d.leads / Math.max(totalLeads, 1))) / d.matriculas
          : 0,
    }))
    .sort((a, b) => b.leads - a.leads);

  // By source
  const sourceMap = new Map<string, { count: number; matriculas: number }>();
  for (const lead of leads) {
    const e = sourceMap.get(lead.source) ?? { count: 0, matriculas: 0 };
    e.count++;
    if (lead.isWon) e.matriculas++;
    sourceMap.set(lead.source, e);
  }
  const bySource = Array.from(sourceMap.entries())
    .map(([source, d]) => ({ source, ...d }))
    .sort((a, b) => b.count - a.count);

  // By day
  const dayMap = new Map<string, { leads: number; matriculas: number }>();
  for (const lead of leads) {
    const day = lead.createdAt.toISOString().split("T")[0];
    const e = dayMap.get(day) ?? { leads: 0, matriculas: 0 };
    e.leads++;
    if (lead.isWon) e.matriculas++;
    dayMap.set(day, e);
  }
  const byDay = Array.from(dayMap.entries())
    .map(([date, d]) => ({ date, ...d }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return { totalLeads, totalMatriculas, totalLost, totalRevenue, cpa, byStage, byCourse, bySource, byDay };
}
