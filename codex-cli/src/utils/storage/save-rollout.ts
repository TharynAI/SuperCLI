import type { ResponseItem } from "openai/resources/responses/responses";

import { loadConfig } from "../config";
import { log } from "../logger/log.js";
import fs from "fs/promises";
import os from "os";
import path from "path";

const SESSIONS_ROOT = path.join(os.homedir(), ".codex", "sessions");
// Default project-local sessions directory
const PROJECT_SESSIONS_ROOT = path.resolve(process.cwd(), "_sessions");

/**
 * Determine the directory to save session rollouts:
 * 1. CODEX_SESSIONS_ROOT env var
 * 2. project-local './_sessions'
 * 3. fallback to home directory (~/.codex/sessions)
 */
export function getSessionsRoot(): string {
  const envRoot = process.env["CODEX_SESSIONS_ROOT"];
  if (envRoot && envRoot.trim() !== "") {
    return path.resolve(envRoot);
  }
  return PROJECT_SESSIONS_ROOT;
}

async function saveRolloutAsync(
  sessionId: string,
  items: Array<ResponseItem>,
): Promise<void> {
  // Compute target sessions directory and ensure it exists
  let root = getSessionsRoot();
  try {
    await fs.mkdir(root, { recursive: true });
  } catch (err: unknown) {
    const fallbackReason = err instanceof Error ? err.message : String(err);
    log(`Warning: failed to use sessions directory '${root}': ${fallbackReason}. Falling back to home directory.`);
    root = SESSIONS_ROOT;
    try {
      await fs.mkdir(root, { recursive: true });
    } catch {
      // best-effort fallback; if this also fails, writeFile below will error
    }
  }

  const timestamp = new Date().toISOString();
  const ts = timestamp.replace(/[:.]/g, "-").slice(0, 10);
  const filename = `rollout-${ts}-${sessionId}.json`;
  const filePath = path.join(root, filename);
  const config = loadConfig();

  try {
    await fs.writeFile(
      filePath,
      JSON.stringify(
        {
          session: {
            timestamp,
            id: sessionId,
            instructions: config.instructions,
          },
          items,
        },
        null,
        2,
      ),
      "utf8",
    );
  } catch (error) {
    log(`error: failed to save rollout to ${filePath}: ${error}`);
  }
}

export function saveRollout(
  sessionId: string,
  items: Array<ResponseItem>,
): void {
  // Best-effort. We also do not log here in case of failure as that should be taken care of
  // by `saveRolloutAsync` already.
  saveRolloutAsync(sessionId, items).catch(() => {});
}
