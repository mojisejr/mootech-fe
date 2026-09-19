// GET /api/launch/status — current production state for the launch console (armed? project discovered?
// maintenance? v2 locked?). Read-only. Gated at the edge (middleware guardLaunch) AND here (isLaunchAuthed).
import type { NextApiRequest, NextApiResponse } from "next";
import { isLaunchAuthed } from "@/lib/launch/auth";
import { isLaunchArmed, readEnvState, resolveProject } from "@/lib/launch/vercel";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isLaunchAuthed(req)) {
    res.status(401).json({ error: { message: "Not authenticated" } });
    return;
  }
  const armed = isLaunchArmed();
  if (!armed.armed) {
    res.status(200).json({ armed: false, missing: armed.missing, project: null, env: null });
    return;
  }
  // armed = token + deploy hook present. Project/team are auto-discovered — surface the result so the
  // operator can confirm the right project was found (option ก) before the real press.
  try {
    const project = await resolveProject();
    const env = await readEnvState();
    res.status(200).json({
      armed: true,
      missing: [],
      project: { projectId: project.projectId, teamId: project.teamId ?? null, via: project.via },
      env,
    });
  } catch (e) {
    res.status(200).json({
      armed: true,
      missing: [],
      project: null,
      env: null,
      error: e instanceof Error ? e.message : "discovery/status failed",
    });
  }
}
