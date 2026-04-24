/**
 * Job automatico de limpeza da lixeira.
 *
 * Por seguranca operacional, roda em dry-run por padrao. Para ativar delecao
 * real, defina CLEANUP_TRASH_DRY_RUN=false no ambiente.
 */
import { sql } from "drizzle-orm";
import { cleanupExpiredTrash, getDb } from "../db";

const CLEANUP_HOUR = 2;
const CLEANUP_LOCK_KEY = 2026042402;

function extractRows(result: unknown): Record<string, unknown>[] {
  const r = result as Record<string, unknown>;
  if (Array.isArray(r.rows)) return r.rows as Record<string, unknown>[];
  if (Array.isArray(r[0])) return r[0] as Record<string, unknown>[];
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  return [];
}

function isDryRunEnabled(): boolean {
  return process.env.CLEANUP_TRASH_DRY_RUN !== "false";
}

function msUntilNextCleanup(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(CLEANUP_HOUR, 0, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

export async function runCleanupTrashJob(options: { dryRun?: boolean } = {}) {
  const db = await getDb();
  if (!db) return { skipped: true, reason: "db_unavailable" as const };

  const lockResult = await db.execute(
    sql`SELECT pg_try_advisory_lock(${CLEANUP_LOCK_KEY}) AS locked`
  );
  const locked = extractRows(lockResult)[0]?.locked === true;
  if (!locked) return { skipped: true, reason: "lock_unavailable" as const };

  try {
    const result = await cleanupExpiredTrash(30, {
      dryRun: options.dryRun ?? isDryRunEnabled(),
    });
    console.log(
      `[CleanupJob] dryRun=${result.dryRun} expired=${result.expiredCount} deleted=${result.deletedCount} storageObjects=${result.storageObjectCount}`
    );
    return { skipped: false as const, ...result };
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(${CLEANUP_LOCK_KEY})`);
  }
}

function scheduleNextCleanup() {
  const delay = msUntilNextCleanup();
  setTimeout(async () => {
    try {
      await runCleanupTrashJob();
    } catch (error) {
      console.error("[CleanupJob] Erro ao limpar lixeira:", error);
    } finally {
      scheduleNextCleanup();
    }
  }, delay);
}

export function startCleanupJob() {
  console.log(
    `[CleanupJob] Iniciado - horario ${CLEANUP_HOUR}h, dryRun=${isDryRunEnabled()}`
  );
  scheduleNextCleanup();
}
