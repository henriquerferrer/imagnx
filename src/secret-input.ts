// TTY raw-mode secret reader for `imagnx login`. Echoes nothing while typing,
// handles backspace, ^C, and ^D. Restores the previous raw-mode state on exit.
export function readSecret(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw ?? false;
    if (stdin.isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    let buffer = "";
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        if (ch === "\u0003") {
          cleanup();
          process.stdout.write("\n");
          process.exit(130);
        }
        if (ch === "\r" || ch === "\n" || ch === "\u0004") {
          cleanup();
          process.stdout.write("\n");
          resolve(buffer);
          return;
        }
        if (ch === "\u007f" || ch === "\b") {
          buffer = buffer.slice(0, -1);
          continue;
        }
        buffer += ch;
      }
    };
    const cleanup = () => {
      stdin.removeListener("data", onData);
      if (stdin.isTTY) stdin.setRawMode(wasRaw);
      stdin.pause();
    };
    stdin.on("data", onData);
  });
}
