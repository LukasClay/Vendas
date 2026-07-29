import type { SessionAdvisoryLock } from "../db";
import { tryAcquireSessionAdvisoryLock } from "../db";
import { startAlertsJob } from "./alertsJob";
import { startReportsJob } from "./reportsJob";

const DEFAULT_LOCK_NAME = "mundo-da-magia:background-jobs:v1";
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;
const DEFAULT_RETRY_BASE_MS = 5_000;
const DEFAULT_RETRY_MAX_MS = 30_000;
const DEFAULT_RETRY_JITTER_RATIO = 0.2;

type MaybePromise<T> = T | Promise<T>;
type JobCleanup = () => MaybePromise<void>;
type JobStarter = () => MaybePromise<JobCleanup | void>;
type TimerHandle = unknown;

interface LeadershipLogger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

interface LeadershipTimers {
  setTimeout(callback: () => void, delayMs: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

export interface JobLeadershipOptions {
  lockName?: string;
  heartbeatIntervalMs?: number;
  retryBaseMs?: number;
  retryMaxMs?: number;
  retryJitterRatio?: number;
  tryAcquireLock?: (lockName: string) => Promise<SessionAdvisoryLock | null>;
  startAlerts?: JobStarter;
  startReports?: JobStarter;
  timers?: LeadershipTimers;
  random?: () => number;
  logger?: LeadershipLogger;
}

export interface JobLeadershipController {
  stop(): Promise<void>;
}

const defaultTimers: LeadershipTimers = {
  setTimeout(callback, delayMs) {
    return globalThis.setTimeout(callback, delayMs);
  },
  clearTimeout(handle) {
    globalThis.clearTimeout(handle as ReturnType<typeof globalThis.setTimeout>);
  },
};

const defaultLogger: LeadershipLogger = {
  info(message) {
    console.info(message);
  },
  warn(message) {
    console.warn(message);
  },
  error(message) {
    console.error(message);
  },
};

function requirePositiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer`);
  }
  return value;
}

function requireJitterRatio(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new TypeError("retryJitterRatio must be between 0 and 1");
  }
  return value;
}

function safeErrorName(error: unknown): string {
  if (error instanceof Error && /^[A-Za-z0-9_.-]{1,64}$/.test(error.name)) {
    return error.name;
  }
  return "UnknownError";
}

export function startJobLeadership(
  options: JobLeadershipOptions = {}
): JobLeadershipController {
  const lockName = options.lockName ?? DEFAULT_LOCK_NAME;
  const heartbeatIntervalMs = requirePositiveInteger(
    options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS,
    "heartbeatIntervalMs"
  );
  const retryBaseMs = requirePositiveInteger(
    options.retryBaseMs ?? DEFAULT_RETRY_BASE_MS,
    "retryBaseMs"
  );
  const retryMaxMs = requirePositiveInteger(
    options.retryMaxMs ?? DEFAULT_RETRY_MAX_MS,
    "retryMaxMs"
  );
  if (retryMaxMs < retryBaseMs) {
    throw new TypeError(
      "retryMaxMs must be greater than or equal to retryBaseMs"
    );
  }
  const retryJitterRatio = requireJitterRatio(
    options.retryJitterRatio ?? DEFAULT_RETRY_JITTER_RATIO
  );

  const acquireLock = options.tryAcquireLock ?? tryAcquireSessionAdvisoryLock;
  const startAlerts = options.startAlerts ?? (() => startAlertsJob());
  const startReports = options.startReports ?? (() => startReportsJob());
  const timers = options.timers ?? defaultTimers;
  const random = options.random ?? Math.random;
  const logger = options.logger ?? defaultLogger;

  let stopped = false;
  let generation = 0;
  let consecutiveFollowerAttempts = 0;
  let retryTimer: TimerHandle | null = null;
  let heartbeatTimer: TimerHandle | null = null;
  let activeLock: SessionAdvisoryLock | null = null;
  let activeLossUnsubscribe: (() => void) | null = null;
  let activeCleanups: JobCleanup[] = [];
  let acquisitionInFlight: Promise<void> | null = null;
  let heartbeatInFlight: Promise<void> | null = null;
  let relinquishInFlight: Promise<void> | null = null;
  let stopPromise: Promise<void> | null = null;

  const clearRetryTimer = () => {
    if (retryTimer === null) return;
    timers.clearTimeout(retryTimer);
    retryTimer = null;
  };

  const clearHeartbeatTimer = () => {
    if (heartbeatTimer === null) return;
    timers.clearTimeout(heartbeatTimer);
    heartbeatTimer = null;
  };

  const releaseLockSafely = async (lock: SessionAdvisoryLock) => {
    try {
      await lock.release();
    } catch (error) {
      logger.error(
        `[JobLeadership] Failed to release leadership lock (${safeErrorName(error)})`
      );
    }
  };

  const runCleanups = async (cleanups: JobCleanup[]) => {
    for (const cleanup of [...cleanups].reverse()) {
      try {
        await cleanup();
      } catch (error) {
        logger.error(
          `[JobLeadership] Job cleanup failed (${safeErrorName(error)})`
        );
      }
    }
  };

  const retryDelay = () => {
    const exponent = Math.min(consecutiveFollowerAttempts, 10);
    const withoutJitter = Math.min(
      retryMaxMs,
      retryBaseMs * Math.pow(2, exponent)
    );
    const randomValue = Math.max(0, Math.min(1, random()));
    const jitterMultiplier = 1 + (randomValue * 2 - 1) * retryJitterRatio;
    return Math.max(1, Math.round(withoutJitter * jitterMultiplier));
  };

  const scheduleRetry = (reason: "follower" | "error" | "lock_lost") => {
    if (stopped || activeLock || retryTimer !== null) return;

    const delayMs = retryDelay();
    consecutiveFollowerAttempts += 1;
    const shouldLogRetry =
      reason !== "follower" ||
      consecutiveFollowerAttempts === 1 ||
      consecutiveFollowerAttempts % 10 === 0;
    if (shouldLogRetry) {
      logger.info(
        `[JobLeadership] ${reason}; retrying leadership in ${delayMs}ms`
      );
    }
    retryTimer = timers.setTimeout(() => {
      retryTimer = null;
      if (stopped || activeLock) return;
      if (acquisitionInFlight !== null || relinquishInFlight !== null) {
        // Um starter assíncrono ainda pode estar concluindo o cleanup da
        // liderança anterior. Reagendar evita consumir o único retry.
        scheduleRetry(reason);
        return;
      }
      beginAcquisition();
    }, delayMs);
  };

  const relinquishLeadership = async (
    reason: "lock_lost" | "starter_failed" | "stopped",
    retry: boolean
  ) => {
    if (relinquishInFlight) {
      await relinquishInFlight;
      if (retry && !stopped) scheduleRetry("lock_lost");
      return;
    }

    clearHeartbeatTimer();
    generation += 1;

    const lossUnsubscribe = activeLossUnsubscribe;
    activeLossUnsubscribe = null;
    lossUnsubscribe?.();

    const lockToRelease = activeLock;
    activeLock = null;
    const cleanupsToRun = activeCleanups;
    activeCleanups = [];

    const transition = (async () => {
      await runCleanups(cleanupsToRun);
      if (lockToRelease) await releaseLockSafely(lockToRelease);
      logger.info(`[JobLeadership] Leadership relinquished (${reason})`);
    })();
    relinquishInFlight = transition;

    try {
      await transition;
    } finally {
      if (relinquishInFlight === transition) relinquishInFlight = null;
    }

    if (retry && !stopped) {
      scheduleRetry(reason === "lock_lost" ? "lock_lost" : "error");
    }
  };

  const scheduleHeartbeat = (
    leadershipGeneration: number,
    lock: SessionAdvisoryLock
  ) => {
    if (
      stopped ||
      generation !== leadershipGeneration ||
      activeLock !== lock ||
      heartbeatTimer !== null ||
      heartbeatInFlight !== null
    ) {
      return;
    }

    heartbeatTimer = timers.setTimeout(() => {
      heartbeatTimer = null;
      void runHeartbeat(leadershipGeneration, lock);
    }, heartbeatIntervalMs);
  };

  const runHeartbeat = async (
    leadershipGeneration: number,
    lock: SessionAdvisoryLock
  ) => {
    if (
      stopped ||
      generation !== leadershipGeneration ||
      activeLock !== lock ||
      heartbeatInFlight !== null
    ) {
      return;
    }

    let heartbeatSucceeded = false;
    const heartbeat = (async () => {
      try {
        await lock.heartbeat();
        heartbeatSucceeded = true;
      } catch (error) {
        if (
          stopped ||
          generation !== leadershipGeneration ||
          activeLock !== lock
        ) {
          return;
        }
        logger.warn(
          `[JobLeadership] Leadership heartbeat failed (${safeErrorName(error)})`
        );
        await relinquishLeadership("lock_lost", true);
      }
    })();
    heartbeatInFlight = heartbeat;

    try {
      await heartbeat;
    } finally {
      if (heartbeatInFlight === heartbeat) heartbeatInFlight = null;
    }

    if (heartbeatSucceeded) {
      scheduleHeartbeat(leadershipGeneration, lock);
    }
  };

  const activateLeadership = async (
    acquisitionGeneration: number,
    lock: SessionAdvisoryLock
  ) => {
    if (stopped || generation !== acquisitionGeneration) {
      await releaseLockSafely(lock);
      return;
    }

    activeLock = lock;
    consecutiveFollowerAttempts = 0;
    const leadershipGeneration = ++generation;
    const isCurrentLeadership = () =>
      !stopped && generation === leadershipGeneration && activeLock === lock;

    let lossUnsubscribe: () => void;
    try {
      lossUnsubscribe = lock.onLost(error => {
        if (!isCurrentLeadership()) return;

        logger.warn(
          `[JobLeadership] Leadership connection lost (${safeErrorName(error)})`
        );
        void relinquishLeadership("lock_lost", true);
      });
    } catch (error) {
      logger.error(
        `[JobLeadership] Failed to monitor leadership lock (${safeErrorName(error)})`
      );
      await relinquishLeadership("starter_failed", true);
      return;
    }

    if (!isCurrentLeadership()) {
      lossUnsubscribe();
      await relinquishLeadership("stopped", false);
      return;
    }

    activeLossUnsubscribe = lossUnsubscribe;
    logger.info("[JobLeadership] Leadership acquired");

    try {
      const alertsCleanup = await startAlerts();
      if (!isCurrentLeadership()) {
        if (typeof alertsCleanup === "function") {
          await runCleanups([alertsCleanup]);
        }
        await relinquishLeadership("stopped", false);
        return;
      }
      if (typeof alertsCleanup === "function") {
        // A validação e o registro são síncronos entre si: a perda do lock não
        // pode intercalar e deixar este cleanup fora do snapshot.
        activeCleanups.push(alertsCleanup);
      }

      const reportsCleanup = await startReports();
      if (!isCurrentLeadership()) {
        if (typeof reportsCleanup === "function") {
          await runCleanups([reportsCleanup]);
        }
        await relinquishLeadership("stopped", false);
        return;
      }
      if (typeof reportsCleanup === "function") {
        activeCleanups.push(reportsCleanup);
      }
    } catch (error) {
      logger.error(
        `[JobLeadership] Failed to start background jobs (${safeErrorName(error)})`
      );
      await relinquishLeadership("starter_failed", true);
      return;
    }

    logger.info("[JobLeadership] Background jobs started by leader");
    scheduleHeartbeat(leadershipGeneration, lock);
  };

  const attemptAcquisition = async (acquisitionGeneration: number) => {
    let lock: SessionAdvisoryLock | null;
    try {
      lock = await acquireLock(lockName);
    } catch (error) {
      if (stopped || generation !== acquisitionGeneration) return;
      logger.warn(
        `[JobLeadership] Leadership acquisition failed (${safeErrorName(error)})`
      );
      scheduleRetry("error");
      return;
    }

    if (!lock) {
      if (!stopped && generation === acquisitionGeneration) {
        scheduleRetry("follower");
      }
      return;
    }

    await activateLeadership(acquisitionGeneration, lock);
  };

  function beginAcquisition() {
    if (
      stopped ||
      activeLock ||
      acquisitionInFlight !== null ||
      relinquishInFlight !== null
    ) {
      return;
    }

    const acquisitionGeneration = generation;
    const acquisition = attemptAcquisition(acquisitionGeneration).catch(
      error => {
        if (!stopped && generation === acquisitionGeneration) {
          logger.error(
            `[JobLeadership] Unexpected acquisition failure (${safeErrorName(error)})`
          );
          scheduleRetry("error");
        }
      }
    );
    acquisitionInFlight = acquisition;
    void acquisition.finally(() => {
      if (acquisitionInFlight === acquisition) acquisitionInFlight = null;
    });
  }

  const stop = () => {
    if (stopPromise) return stopPromise;

    stopped = true;
    generation += 1;
    clearRetryTimer();
    clearHeartbeatTimer();

    stopPromise = (async () => {
      const acquisition = acquisitionInFlight;
      if (acquisition) await acquisition;

      const heartbeat = heartbeatInFlight;
      if (heartbeat) await heartbeat;

      const relinquish = relinquishInFlight;
      if (relinquish) await relinquish;

      await relinquishLeadership("stopped", false);
    })();

    return stopPromise;
  };

  beginAcquisition();

  return { stop };
}
