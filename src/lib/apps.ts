import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type OwnApp = { id: string; name: string; description: string | null; archived_at: string | null };
export type AppSummary = OwnApp & { round_count: number; platforms: ("android" | "ios")[] };
export type AppsData = { apps: AppSummary[]; metrics: { applications: number; campaigns_created: number; testers_reached: number } };
export type AppsFilter = "all" | "active" | "archived";

export function parseAppsFilter(value: unknown): AppsFilter {
  return value === "active" || value === "archived" ? value : "all";
}
export function isAppId(value: unknown): value is string {
  return typeof value === "string" && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value);
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isApp(value: unknown): value is OwnApp {
  return isRecord(value) && isAppId(value.id) && typeof value.name === "string" &&
    (value.description === null || typeof value.description === "string") &&
    (value.archived_at === null || (typeof value.archived_at === "string" && Number.isFinite(Date.parse(value.archived_at))));
}
function projectApp(app: OwnApp): OwnApp {
  return { id: app.id, name: app.name, description: app.description, archived_at: app.archived_at };
}

// Range every direct read so the API row cap cannot silently truncate metrics or history.
async function readAll(query: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<unknown[]> {
  const rows: unknown[] = [];
  const size = 500;
  for (let offset = 0; ; offset += size) {
    const { data, error } = await query(offset, offset + size - 1);
    if (error || !Array.isArray(data)) throw new Error("Apps could not be loaded.");
    rows.push(...data);
    if (data.length < size) return rows;
  }
}

export async function getAppsData(): Promise<AppsData> {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("Apps authentication required.");
  // RLS remains the authority; inner joins also exclude unrelated tester participations.
  const [apps, campaigns, participations] = await Promise.all([
    readAll((from, to) => supabase.from("apps").select("id,name,description,archived_at").eq("owner_id", user.id).order("id").range(from, to)),
    readAll((from, to) => supabase.from("test_campaigns").select("id,app_id,platform,apps!inner(owner_id)").eq("apps.owner_id", user.id).order("id").range(from, to)),
    readAll((from, to) => supabase.from("test_participations").select("tester_id,test_campaigns!inner(apps!inner(owner_id))").eq("test_campaigns.apps.owner_id", user.id).order("id").range(from, to)),
  ]);
  if (!apps.every(isApp) || !campaigns.every((row) => isRecord(row) && isAppId(row.id) && isAppId(row.app_id) && (row.platform === "android" || row.platform === "ios")) ||
      !participations.every((row) => isRecord(row) && isAppId(row.tester_id))) {
    throw new Error("Apps returned an invalid response.");
  }
  const rounds = campaigns as { id: string; app_id: string; platform: "android" | "ios" }[];
  const summaries = apps.map((app) => {
    const ownRounds = rounds.filter((round) => round.app_id === app.id);
    return { ...projectApp(app), round_count: ownRounds.length, platforms: (["android", "ios"] as const).filter((platform) => ownRounds.some((round) => round.platform === platform)) };
  });
  return {
    apps: summaries,
    metrics: {
      applications: apps.filter((app) => app.archived_at === null).length,
      campaigns_created: rounds.length,
      testers_reached: new Set(participations.map((row) => (row as { tester_id: string }).tester_id)).size,
    },
  };
}

export async function getOwnApp(appId: string): Promise<(OwnApp & { round_count: number }) | null> {
  if (!isAppId(appId)) return null;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) throw new Error("Apps authentication required.");
  const { data, error } = await supabase.from("apps").select("id,name,description,archived_at").eq("id", appId).eq("owner_id", user.id).maybeSingle();
  if (error) throw new Error("App could not be loaded.");
  if (data === null) return null;
  if (!isApp(data)) throw new Error("App returned an invalid response.");
  const { count, error: countError } = await supabase.from("test_campaigns").select("id", { count: "exact", head: true }).eq("app_id", data.id);
  if (countError || count === null) throw new Error("App rounds could not be counted.");
  return { ...projectApp(data), round_count: count };
}
