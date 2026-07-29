import { describe, expect, it, vi } from "vitest";
import type { SessionAdvisoryLock } from "../db";
import { startJobLeadership, type JobLeadershipOptions } from "./jobLeadership";

vi.mock("../db", () => ({
  tryAcquireSessionAdvisoryLock: vi.fn(),
}));
vi.mock("./alertsJob", () => ({
  startAlertsJob: vi.fn(),
}));
vi.mock("./reportsJob", () => ({
  startReportsJob: vi.fn(),
}));

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

class ManualTimers {
  private nextId = 1;
  private readonly tasks = new Map<number, () => void>();

  readonly api = {
    setTimeout: (callback: () => void, _delayMs: number) => {
      const id = this.nextId++;
      this.tasks.set(id, callback);
      return id;
    },
    clearTimeout: (handle: unknown) => {
      this.tasks.delete(handle as number);
    },
  };

  get size() {
    return this.tasks.size;
  }

  runNext(): boolean {
    const next = this.tasks.entries().next();
    if (next.done) return false;
    const [id, callback] = next.value;
    this.tasks.delete(id);
    callback();
    return true;
  }
}

interface TestLock extends SessionAdvisoryLock {
  emitLost(error: Error): void;
}

function createLock(
  heartbeatImplementation: () => Promise<void> = async () => undefined
): TestLock {
  const lossListeners = new Set<(error: Error) => void>();
  return {
    onLost: vi.fn((listener: (error: Error) => void) => {
      lossListeners.add(listener);
      return () => {
        lossListeners.delete(listener);
      };
    }),
    heartbeat: vi.fn(heartbeatImplementation),
    release: vi.fn(async () => undefined),
    emitLost(error) {
      lossListeners.forEach(listener => {
        listener(error);
      });
    },
  } satisfies TestLock;
}

async function flushAsyncWork() {
  for (let index = 0; index < 12; index += 1) {
    await Promise.resolve();
  }
}

function createOptions(
  overrides: Partial<JobLeadershipOptions> = {}
): JobLeadershipOptions {
  return {
    heartbeatIntervalMs: 100,
    retryBaseMs: 100,
    retryMaxMs: 400,
    retryJitterRatio: 0,
    random: () => 0.5,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    ...overrides,
  };
}

describe("jobLeadership", () => {
  it("starts both jobs on only one leader", async () => {
    const leaderLock = createLock();
    let granted = false;
    const tryAcquireLock = vi.fn(async () => {
      if (granted) return null;
      granted = true;
      return leaderLock;
    });
    const startAlerts = vi.fn(() => vi.fn());
    const startReports = vi.fn(() => vi.fn());
    const leaderTimers = new ManualTimers();
    const followerTimers = new ManualTimers();

    const first = startJobLeadership(
      createOptions({
        tryAcquireLock,
        startAlerts,
        startReports,
        timers: leaderTimers.api,
      })
    );
    const second = startJobLeadership(
      createOptions({
        tryAcquireLock,
        startAlerts,
        startReports,
        timers: followerTimers.api,
      })
    );

    await flushAsyncWork();

    expect(tryAcquireLock).toHaveBeenCalledTimes(2);
    expect(startAlerts).toHaveBeenCalledOnce();
    expect(startReports).toHaveBeenCalledOnce();
    expect(leaderTimers.size).toBe(1);
    expect(followerTimers.size).toBe(1);

    await Promise.all([first.stop(), second.stop()]);
    expect(leaderLock.release).toHaveBeenCalledOnce();
  });

  it("keeps a follower idle and retries leadership", async () => {
    const timers = new ManualTimers();
    const leaderLock = createLock();
    const tryAcquireLock = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(leaderLock);
    const startAlerts = vi.fn(() => vi.fn());
    const startReports = vi.fn(() => vi.fn());
    const controller = startJobLeadership(
      createOptions({
        tryAcquireLock,
        startAlerts,
        startReports,
        timers: timers.api,
      })
    );

    await flushAsyncWork();
    expect(startAlerts).not.toHaveBeenCalled();
    expect(startReports).not.toHaveBeenCalled();
    expect(timers.size).toBe(1);

    expect(timers.runNext()).toBe(true);
    await flushAsyncWork();

    expect(tryAcquireLock).toHaveBeenCalledTimes(2);
    expect(startAlerts).toHaveBeenCalledOnce();
    expect(startReports).toHaveBeenCalledOnce();

    await controller.stop();
    expect(leaderLock.release).toHaveBeenCalledOnce();
  });

  it("cleans up, releases and re-elects after heartbeat loss", async () => {
    const timers = new ManualTimers();
    const firstLock = createLock(async () => {
      throw new Error("connection lost");
    });
    const secondLock = createLock();
    const tryAcquireLock = vi
      .fn()
      .mockResolvedValueOnce(firstLock)
      .mockResolvedValueOnce(secondLock);
    const firstAlertsCleanup = vi.fn();
    const secondAlertsCleanup = vi.fn();
    const firstReportsCleanup = vi.fn();
    const secondReportsCleanup = vi.fn();
    const startAlerts = vi
      .fn()
      .mockReturnValueOnce(firstAlertsCleanup)
      .mockReturnValueOnce(secondAlertsCleanup);
    const startReports = vi
      .fn()
      .mockReturnValueOnce(firstReportsCleanup)
      .mockReturnValueOnce(secondReportsCleanup);

    const controller = startJobLeadership(
      createOptions({
        tryAcquireLock,
        startAlerts,
        startReports,
        timers: timers.api,
      })
    );
    await flushAsyncWork();

    expect(timers.runNext()).toBe(true);
    await flushAsyncWork();

    expect(firstAlertsCleanup).toHaveBeenCalledOnce();
    expect(firstReportsCleanup).toHaveBeenCalledOnce();
    expect(firstLock.release).toHaveBeenCalledOnce();
    expect(timers.size).toBe(1);

    expect(timers.runNext()).toBe(true);
    await flushAsyncWork();

    expect(startAlerts).toHaveBeenCalledTimes(2);
    expect(startReports).toHaveBeenCalledTimes(2);

    await controller.stop();
    expect(secondAlertsCleanup).toHaveBeenCalledOnce();
    expect(secondReportsCleanup).toHaveBeenCalledOnce();
    expect(secondLock.release).toHaveBeenCalledOnce();
  });

  it("demotes immediately when the dedicated connection is lost", async () => {
    const timers = new ManualTimers();
    const firstLock = createLock();
    const secondLock = createLock();
    const tryAcquireLock = vi
      .fn()
      .mockResolvedValueOnce(firstLock)
      .mockResolvedValueOnce(secondLock);
    const firstAlertsCleanup = vi.fn();
    const secondAlertsCleanup = vi.fn();
    const firstReportsCleanup = vi.fn();
    const secondReportsCleanup = vi.fn();
    const startAlerts = vi
      .fn()
      .mockReturnValueOnce(firstAlertsCleanup)
      .mockReturnValueOnce(secondAlertsCleanup);
    const startReports = vi
      .fn()
      .mockReturnValueOnce(firstReportsCleanup)
      .mockReturnValueOnce(secondReportsCleanup);

    const controller = startJobLeadership(
      createOptions({
        tryAcquireLock,
        startAlerts,
        startReports,
        timers: timers.api,
      })
    );
    await flushAsyncWork();

    firstLock.emitLost(new Error("socket closed"));
    await flushAsyncWork();

    expect(firstLock.heartbeat).not.toHaveBeenCalled();
    expect(firstAlertsCleanup).toHaveBeenCalledOnce();
    expect(firstReportsCleanup).toHaveBeenCalledOnce();
    expect(firstLock.release).toHaveBeenCalledOnce();
    expect(timers.size).toBe(1);

    expect(timers.runNext()).toBe(true);
    await flushAsyncWork();

    expect(startAlerts).toHaveBeenCalledTimes(2);
    expect(startReports).toHaveBeenCalledTimes(2);

    await controller.stop();
    expect(secondAlertsCleanup).toHaveBeenCalledOnce();
    expect(secondReportsCleanup).toHaveBeenCalledOnce();
    expect(secondLock.release).toHaveBeenCalledOnce();
  });

  it("cleans up a late alerts starter before reacquiring leadership", async () => {
    const timers = new ManualTimers();
    const pendingAlerts = deferred<() => void>();
    const firstLock = createLock();
    const secondLock = createLock();
    const tryAcquireLock = vi
      .fn()
      .mockResolvedValueOnce(firstLock)
      .mockResolvedValueOnce(secondLock);
    const lateAlertsCleanup = vi.fn();
    const secondAlertsCleanup = vi.fn();
    const secondReportsCleanup = vi.fn();
    const startAlerts = vi
      .fn()
      .mockReturnValueOnce(pendingAlerts.promise)
      .mockReturnValueOnce(secondAlertsCleanup);
    const startReports = vi.fn(() => secondReportsCleanup);

    const controller = startJobLeadership(
      createOptions({
        tryAcquireLock,
        startAlerts,
        startReports,
        timers: timers.api,
      })
    );
    await flushAsyncWork();

    expect(startAlerts).toHaveBeenCalledOnce();
    firstLock.emitLost(new Error("socket closed during alerts startup"));
    await flushAsyncWork();

    expect(firstLock.release).toHaveBeenCalledOnce();
    expect(timers.size).toBe(1);

    expect(timers.runNext()).toBe(true);
    await flushAsyncWork();
    expect(tryAcquireLock).toHaveBeenCalledOnce();
    expect(timers.size).toBe(1);

    pendingAlerts.resolve(lateAlertsCleanup);
    await flushAsyncWork();

    expect(lateAlertsCleanup).toHaveBeenCalledOnce();
    expect(startReports).not.toHaveBeenCalled();

    expect(timers.runNext()).toBe(true);
    await flushAsyncWork();

    expect(tryAcquireLock).toHaveBeenCalledTimes(2);
    expect(startAlerts).toHaveBeenCalledTimes(2);
    expect(startReports).toHaveBeenCalledOnce();
    expect(lateAlertsCleanup.mock.invocationCallOrder[0]).toBeLessThan(
      startAlerts.mock.invocationCallOrder[1]
    );

    await controller.stop();
    expect(secondAlertsCleanup).toHaveBeenCalledOnce();
    expect(secondReportsCleanup).toHaveBeenCalledOnce();
    expect(secondLock.release).toHaveBeenCalledOnce();
  });

  it("cleans up a reports starter that finishes after lock loss", async () => {
    const timers = new ManualTimers();
    const pendingReports = deferred<() => void>();
    const lock = createLock();
    const alertsCleanup = vi.fn();
    const lateReportsCleanup = vi.fn();
    const startAlerts = vi.fn(() => alertsCleanup);
    const startReports = vi.fn(() => pendingReports.promise);
    const controller = startJobLeadership(
      createOptions({
        tryAcquireLock: async () => lock,
        startAlerts,
        startReports,
        timers: timers.api,
      })
    );
    await flushAsyncWork();

    expect(startReports).toHaveBeenCalledOnce();
    lock.emitLost(new Error("socket closed during reports startup"));
    await flushAsyncWork();

    expect(alertsCleanup).toHaveBeenCalledOnce();
    expect(lock.release).toHaveBeenCalledOnce();

    pendingReports.resolve(lateReportsCleanup);
    await flushAsyncWork();

    expect(lateReportsCleanup).toHaveBeenCalledOnce();
    expect(timers.size).toBe(1);

    await controller.stop();
  });

  it("releases a pending acquisition after stop without starting jobs", async () => {
    const pendingAcquisition = deferred<SessionAdvisoryLock | null>();
    const acquiredLock = createLock();
    const startAlerts = vi.fn();
    const startReports = vi.fn();
    const controller = startJobLeadership(
      createOptions({
        tryAcquireLock: () => pendingAcquisition.promise,
        startAlerts,
        startReports,
        timers: new ManualTimers().api,
      })
    );
    await flushAsyncWork();

    const stopping = controller.stop();
    pendingAcquisition.resolve(acquiredLock);
    await stopping;

    expect(startAlerts).not.toHaveBeenCalled();
    expect(startReports).not.toHaveBeenCalled();
    expect(acquiredLock.release).toHaveBeenCalledOnce();
    await expect(controller.stop()).resolves.toBeUndefined();
  });

  it("never overlaps heartbeats", async () => {
    const timers = new ManualTimers();
    const pendingHeartbeats: Deferred<void>[] = [];
    let activeHeartbeats = 0;
    let maxActiveHeartbeats = 0;
    const lock = createLock(() => {
      activeHeartbeats += 1;
      maxActiveHeartbeats = Math.max(maxActiveHeartbeats, activeHeartbeats);
      const pending = deferred<void>();
      pendingHeartbeats.push(pending);
      return pending.promise.finally(() => {
        activeHeartbeats -= 1;
      });
    });
    const controller = startJobLeadership(
      createOptions({
        tryAcquireLock: async () => lock,
        startAlerts: vi.fn(() => vi.fn()),
        startReports: vi.fn(() => vi.fn()),
        timers: timers.api,
      })
    );
    await flushAsyncWork();

    expect(timers.runNext()).toBe(true);
    await flushAsyncWork();
    expect(lock.heartbeat).toHaveBeenCalledOnce();
    expect(timers.runNext()).toBe(false);

    pendingHeartbeats[0].resolve();
    await flushAsyncWork();
    expect(timers.size).toBe(1);

    expect(timers.runNext()).toBe(true);
    await flushAsyncWork();
    expect(lock.heartbeat).toHaveBeenCalledTimes(2);
    expect(maxActiveHeartbeats).toBe(1);

    pendingHeartbeats[1].resolve();
    await flushAsyncWork();
    await controller.stop();
  });
});
