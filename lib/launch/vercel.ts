// lib/launch/vercel.ts — thin Vercel REST helpers for the #606 launch button (server-only; Node runtime).
//
// The launch is a VARIABLE FLIP (the middleware comments spell this out): production env is edited, then
// a redeploy bakes the new values in. Two actions:
//   GO LIVE  -> MAINTENANCE_MODE='off'  +  DELETE V2_PREVIEW_KEY  -> redeploy
//   ROLLBACK -> MAINTENANCE_MODE='on'                              -> redeploy
// Rollback does NOT need to restore V2_PREVIEW_KEY: once that key is unset, middleware's guardV2 returns
// null and /v2 falls through to the maintenance gate, so turning maintenance back on closes the WHOLE
// site (v1 + v2) for everyone. That is why rollback is one variable, not a secret we must remember.
//
// Server env used (set on Vercel, never shipped to the client):
//   VERCEL_TOKEN            — API token (ALREADY present on the Vercel project)
//   LAUNCH_DEPLOY_HOOK_URL  — a Vercel Deploy Hook that redeploys production (one POST = redeploy)
//   VERCEL_PROJECT_ID       — OPTIONAL. If unset it is auto-discovered from the token + PROD_DOMAIN.
//   VERCEL_TEAM_ID          — OPTIONAL. Auto-discovered alongside the project.
// Option (ก): only LAUNCH_KEY + LAUNCH_DEPLOY_HOOK_URL are set by hand; project/team are resolved at
// runtime so the operator copies fewer ids. resolveProject() is surfaced by /api/launch/status and the
// dry-run so เอ็ม can VERIFY discovery worked before the real press (and set VERCEL_PROJECT_ID by hand as
// a fallback if it ever cannot).

const API = "https://api.vercel.com";
const PROD: readonly string[] = ["production"];
// The production domain the launch targets — the anchor for auto-discovering which Vercel project this is.
const PROD_DOMAIN = "bazichart.mumate.co";
// Best first guess for the project name (git repo mojisejr/mootech-fe) — confirmed against PROD_DOMAIN.
const PROJECT_NAME_GUESS = "mootech-fe";

export type EnvState = {
  maintenance: "on" | "off" | "unset" | "unknown";
  v2Locked: boolean; // V2_PREVIEW_KEY present on production
};

export type ResolvedProject = { projectId: string; teamId?: string; via: "env" | "discovered" };

function token(): string | undefined {
  return process.env.VERCEL_TOKEN;
}
function deployHook(): string | undefined {
  return process.env.LAUNCH_DEPLOY_HOOK_URL;
}

/** The two vars the operator MUST set by hand (option ก). Project/team are auto-discovered. */
export function isLaunchArmed(): { armed: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!token()) missing.push("VERCEL_TOKEN");
  if (!deployHook()) missing.push("LAUNCH_DEPLOY_HOOK_URL");
  return { armed: missing.length === 0, missing };
}

function authHeaders(): HeadersInit {
  return { Authorization: `Bearer ${token()}` };
}
function qs(teamId?: string): string {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
}

type VercelProject = { id: string; name: string };

async function getJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

/** Does this project serve PROD_DOMAIN? Best-effort: on any fetch error, don't veto a name match. */
async function projectServesDomain(projectId: string, teamId: string | undefined): Promise<boolean | null> {
  const data = await getJson<{ domains?: Array<{ name: string }> }>(
    `${API}/v9/projects/${projectId}/domains${qs(teamId)}`,
  );
  if (!data?.domains) return null; // unknown (error / no access) — caller treats as "don't veto"
  return data.domains.some((d) => d.name === PROD_DOMAIN);
}

/** The Deploy Hook URL embeds the project id (…/deploy/<prj_…>/<hookId>) — the most authoritative source. */
function projectIdFromHook(): string | undefined {
  const m = (deployHook() ?? "").match(/\/deploy\/(prj_[A-Za-z0-9]+)\//);
  return m?.[1];
}

/** Given a known projectId, find which scope (personal or a team) owns it by probing until one returns it. */
async function resolveTeamForProject(projectId: string, explicitTeam?: string): Promise<ResolvedProject> {
  const scopes: (string | undefined)[] = explicitTeam ? [explicitTeam] : [undefined];
  if (!explicitTeam) {
    const teams = await getJson<{ teams?: Array<{ id: string }> }>(`${API}/v2/teams`);
    for (const t of teams?.teams ?? []) scopes.push(t.id);
  }
  for (const teamId of scopes) {
    const hit = await getJson<VercelProject>(`${API}/v9/projects/${projectId}${qs(teamId)}`);
    if (hit?.id) return { projectId, teamId, via: "discovered" };
  }
  // Could not confirm the team, but the id is authoritative — return it (env calls will surface any 403).
  return { projectId, teamId: explicitTeam, via: "discovered" };
}

let cachedProject: ResolvedProject | null = null;

/** Resolve which Vercel project/team to operate on. Explicit env wins; else the id from the deploy hook;
 *  else discover via token + PROD_DOMAIN. teamId is probed so team-scoped env calls carry ?teamId. */
export async function resolveProject(): Promise<ResolvedProject> {
  if (cachedProject) return cachedProject;
  if (!token()) throw new Error("VERCEL_TOKEN ไม่ได้ตั้งค่าบน Vercel");

  const explicitTeam = process.env.VERCEL_TEAM_ID || undefined;

  const explicitId = process.env.VERCEL_PROJECT_ID;
  if (explicitId) {
    cachedProject = { projectId: explicitId, teamId: explicitTeam, via: "env" };
    return cachedProject;
  }

  // Prefer the project id embedded in the Deploy Hook URL — authoritative, no guessing.
  const hookId = projectIdFromHook();
  if (hookId) {
    cachedProject = await resolveTeamForProject(hookId, explicitTeam);
    return cachedProject;
  }

  // Candidate scopes: an explicit team, else personal + every team the token can see.
  const scopes: (string | undefined)[] = explicitTeam ? [explicitTeam] : [undefined];
  if (!explicitTeam) {
    const teams = await getJson<{ teams?: Array<{ id: string }> }>(`${API}/v2/teams`);
    for (const t of teams?.teams ?? []) scopes.push(t.id);
  }

  for (const teamId of scopes) {
    // 1) direct name hit, confirmed by domain when we can read it
    const byName = await getJson<VercelProject>(`${API}/v9/projects/${PROJECT_NAME_GUESS}${qs(teamId)}`);
    if (byName?.id) {
      const serves = await projectServesDomain(byName.id, teamId);
      if (serves !== false) {
        cachedProject = { projectId: byName.id, teamId, via: "discovered" };
        return cachedProject;
      }
    }
    // 2) scan the scope's projects and match by domain (authoritative), else by name substring
    const list = await getJson<{ projects?: VercelProject[] }>(`${API}/v9/projects?limit=100${teamId ? `&teamId=${encodeURIComponent(teamId)}` : ""}`);
    let nameFallback: VercelProject | null = null;
    for (const p of list?.projects ?? []) {
      if (/mootech|mumate|bazichart/i.test(p.name) && !nameFallback) nameFallback = p;
      if ((await projectServesDomain(p.id, teamId)) === true) {
        cachedProject = { projectId: p.id, teamId, via: "discovered" };
        return cachedProject;
      }
    }
    if (nameFallback) {
      cachedProject = { projectId: nameFallback.id, teamId, via: "discovered" };
      return cachedProject;
    }
  }
  throw new Error(
    `หา Vercel project ของ ${PROD_DOMAIN} ไม่พบจาก token — ตั้ง VERCEL_PROJECT_ID (และ VERCEL_TEAM_ID ถ้าใต้ทีม) เองแทน`,
  );
}

type VercelEnv = { id: string; key: string; value?: string; target?: string[] | string };

async function listEnv(p: ResolvedProject): Promise<VercelEnv[]> {
  const json = await getJson<{ envs?: VercelEnv[] }>(`${API}/v9/projects/${p.projectId}/env${qs(p.teamId)}`);
  if (!json) throw new Error("อ่าน env จาก Vercel ไม่สำเร็จ (token/สิทธิ์)");
  return json.envs ?? [];
}

function onProd(e: VercelEnv): boolean {
  const t = e.target;
  return Array.isArray(t) ? t.includes("production") : t === "production";
}

async function readEnvStateFor(p: ResolvedProject): Promise<EnvState> {
  const envs = await listEnv(p);
  const maint = envs.find((e) => e.key === "MAINTENANCE_MODE" && onProd(e));
  const v2 = envs.find((e) => e.key === "V2_PREVIEW_KEY" && onProd(e));
  let maintenance: EnvState["maintenance"] = "unset";
  if (maint) maintenance = maint.value === "on" ? "on" : maint.value === undefined ? "unknown" : "off";
  return { maintenance, v2Locked: Boolean(v2) };
}

/** Read current production state of the two launch variables (best-effort; value may be encrypted). */
export async function readEnvState(): Promise<EnvState> {
  const p = await resolveProject();
  return readEnvStateFor(p);
}

async function upsertEnv(p: ResolvedProject, key: string, value: string): Promise<void> {
  const envs = await listEnv(p);
  const existing = envs.filter((e) => e.key === key && onProd(e));
  if (existing.length === 0) {
    const res = await fetch(`${API}/v10/projects/${p.projectId}/env${qs(p.teamId)}`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ key, value, type: "plain", target: PROD }),
    });
    if (!res.ok) throw new Error(`vercel create ${key} failed (${res.status})`);
    return;
  }
  for (const e of existing) {
    const res = await fetch(`${API}/v9/projects/${p.projectId}/env/${e.id}${qs(p.teamId)}`, {
      method: "PATCH",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (!res.ok) throw new Error(`vercel update ${key} failed (${res.status})`);
  }
}

async function deleteEnv(p: ResolvedProject, key: string): Promise<void> {
  const envs = await listEnv(p);
  for (const e of envs.filter((x) => x.key === key && onProd(x))) {
    const res = await fetch(`${API}/v9/projects/${p.projectId}/env/${e.id}${qs(p.teamId)}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    if (!res.ok && res.status !== 404) throw new Error(`vercel delete ${key} failed (${res.status})`);
  }
}

async function redeploy(): Promise<void> {
  const hook = deployHook();
  if (!hook) throw new Error("LAUNCH_DEPLOY_HOOK_URL ไม่ได้ตั้งค่า");
  const res = await fetch(hook, { method: "POST" });
  if (!res.ok) throw new Error(`deploy hook failed (${res.status})`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 2026-09-20 (เอ็มพบ live): goLive() เคย upsertEnv แล้ว redeploy() ทันที — เจอเคสจริงที่ deploy hook
// สั่ง build ก่อน Vercel เอา env ใหม่ (MAINTENANCE_MODE=off) เข้า build pipeline ทัน (race), ผลคือ
// deployment ใหม่ "Ready" + ติด tag Production ปกติ แต่ยัง bake MAINTENANCE_MODE=on ค้างอยู่ — แก้ด้วย
// poll readEnvState() ยืนยันค่าที่เขียนไปแล้ว "อ่านกลับมาตรงจริง" ก่อนค่อยยิง deploy hook (best-effort:
// timeout แล้วไม่ throw — ยังยิง redeploy ต่อ เผื่อ Vercel แค่ตอบช้าแต่ apply แล้วจริง).
async function waitForEnvPropagation(
  p: ResolvedProject,
  expected: Pick<EnvState, "maintenance">,
  { attempts = 5, delayMs = 800 }: { attempts?: number; delayMs?: number } = {},
): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const state = await readEnvStateFor(p);
      if (state.maintenance === expected.maintenance) return;
    } catch {
      /* best-effort — ลองรอบถัดไป */
    }
    await sleep(delayMs);
  }
}

/** GO LIVE: maintenance off + drop the v2 lock + redeploy. Idempotent. */
export async function goLive(): Promise<void> {
  const p = await resolveProject();
  await upsertEnv(p, "MAINTENANCE_MODE", "off");
  await deleteEnv(p, "V2_PREVIEW_KEY");
  await waitForEnvPropagation(p, { maintenance: "off" });
  await redeploy();
}

/** ROLLBACK: maintenance on + redeploy (closes the whole site again — see file header). */
export async function rollback(): Promise<void> {
  const p = await resolveProject();
  await upsertEnv(p, "MAINTENANCE_MODE", "on");
  await waitForEnvPropagation(p, { maintenance: "on" });
  await redeploy();
}
