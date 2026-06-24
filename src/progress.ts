// Tiny single-line spinner for fan-out runs. Renders to stderr only when:
//   1. stderr is a TTY (don't junk up piped logs), and
//   2. --json is off (would interleave with the JSON output we send to stdout),
//   3. IMAGNX_NO_PROGRESS isn't set (escape hatch for CI / wrapper scripts).
// Result lines from executeAndOutput still go straight to stdout/stderr; the
// spinner is cleared before each emit and re-rendered after.

export interface ProgressReporter {
  start(): void;
  done(modelId: string, ok: boolean): void;
  stop(): void;
}

const NOOP: ProgressReporter = {
  start() {},
  done() {},
  stop() {},
};

export function createProgress(
  modelIds: string[],
  opts: { isTTY?: boolean; json?: boolean; env?: Record<string, string | undefined> } = {},
): ProgressReporter {
  const isTTY = opts.isTTY ?? !!process.stderr.isTTY;
  const env = opts.env ?? process.env;
  if (!isTTY || opts.json || env.IMAGNX_NO_PROGRESS) return NOOP;
  if (modelIds.length === 0) return NOOP;

  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  const total = modelIds.length;
  const remaining = new Set(modelIds);
  let i = 0;
  let timer: NodeJS.Timeout | undefined;

  const render = () => {
    if (remaining.size === 0) return;
    const frame = frames[i++ % frames.length];
    const label = total === 1
      ? `${frame} ${[...remaining][0]}`
      : `${frame} ${total - remaining.size}/${total} done — running ${[...remaining].join(", ")}`;
    process.stderr.write(`\r\x1b[2K${label}`);
  };

  const clear = () => process.stderr.write("\r\x1b[2K");

  return {
    start() {
      render();
      timer = setInterval(render, 80);
    },
    done(modelId) {
      remaining.delete(modelId);
      clear();
      render();
    },
    stop() {
      if (timer) clearInterval(timer);
      clear();
    },
  };
}
