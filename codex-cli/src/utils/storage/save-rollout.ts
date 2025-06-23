import type { ResponseItem } from "openai/resources/responses/responses";

import { loadConfig } from "../config";
import { log } from "../logger/log.js";
import fs from "fs/promises";
import os from "os";
import path from "path";

const SESSIONS_ROOT = path.join(os.homedir(), ".codex", "sessions");
// [2025-06-23 10:45] Purpose: default local sessions folder relative to project root
// Change: introduced PROJECT_SESSIONS_ROOT to store rollouts in './_sessions'
// Default project-local sessions directory
const PROJECT_SESSIONS_ROOT = path.resolve(process.cwd(), "_sessions");

/**
 * Determine the directory to save session rollouts:
 * [2025-06-23 10:45] Purpose: support override of sessions directory
 * Change: implemented getSessionsRoot() using CODEX_SESSIONS_ROOT or PROJECT_SESSIONS_ROOT
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

// [2025-06-23 10:45] Purpose: prevent multiple session files per run
// Change: introduced SESSION_FILENAME_CACHE to reuse filename for the session
// Cache filenames per session to avoid creating multiple files
const SESSION_FILENAME_CACHE: Record<string, string> = {};
/**
 * Asynchronously write the session rollout JSON once per session.
 */
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
  // [2025-06-23 10:45] Purpose: include timestamp for session metadata
  // Change: moved timestamp declaration outside filename logic
  // Timestamp for inclusion in JSON payload
  const timestamp = new Date().toISOString();

  // [2025-06-23 10:45] Purpose: build session filename using branch and session name
  // Change: updated filename logic to prefix with CODEX_SESSION_BRANCH
  // Determine filename once per session, caching to avoid multiple files
  let filename = SESSION_FILENAME_CACHE[sessionId];
  if (!filename) {
    // Clean session name
    const rawName = process.env["CODEX_SESSION_NAME"];
    const nameSafe = rawName
      ? rawName.trim().replace(/[^a-zA-Z0-9_-]/g, '_')
      : sessionId;
    // Include branch name if available
    const rawBranch = process.env["CODEX_SESSION_BRANCH"];
    const branchSafe = rawBranch
      ? rawBranch.trim().replace(/[^a-zA-Z0-9_-]/g, '_')
      : '';
    filename = branchSafe
      ? `${branchSafe}-${nameSafe}.json`
      : `${nameSafe}.json`;
    SESSION_FILENAME_CACHE[sessionId] = filename;
  }
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
