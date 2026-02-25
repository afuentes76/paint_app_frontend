// src/lib/polling.ts

export type PollOptions<T> = {
  intervalMs: number;
  run: () => Promise<T>;
  onData: (data: T) => void;
  onError?: (err: unknown) => void;
  stopWhen?: (data: T) => boolean;
};

export type PollController = {
  stop: () => void;
};

export function startPolling<T>(opts: PollOptions<T>): PollController {
  let stopped = false;
  let timer: number | null = null;

  const tick = async () => {
    if (stopped) return;

    try {
      const data = await opts.run();
      if (stopped) return;

      opts.onData(data);

      if (opts.stopWhen && opts.stopWhen(data)) {
        stopped = true;
        return;
      }
    } catch (err) {
      if (stopped) return;
      opts.onError?.(err);
    }

    if (!stopped) {
      timer = window.setTimeout(tick, opts.intervalMs);
    }
  };

  timer = window.setTimeout(tick, 0);

  return {
    stop: () => {
      stopped = true;
      if (timer !== null) window.clearTimeout(timer);
    },
  };
}
