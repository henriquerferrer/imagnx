type FetchFn = typeof fetch;

interface Recorded {
  url: string;
  init?: RequestInit;
  responseBody: string;
  responseStatus: number;
  responseHeaders: Record<string, string>;
}

export function installFetchMock(fixtures: Recorded[]): {
  restore: () => void;
  calls: { url: string; init?: RequestInit }[];
} {
  const origFetch: FetchFn = globalThis.fetch;
  const calls: { url: string; init?: RequestInit }[] = [];
  let i = 0;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });
    const f = fixtures[i++];
    if (!f) throw new Error(`fetch-mock: no fixture for call #${i} to ${url}`);
    return new Response(f.responseBody, {
      status: f.responseStatus,
      headers: f.responseHeaders,
    });
  }) as FetchFn;
  return {
    calls,
    restore: () => {
      globalThis.fetch = origFetch;
    },
  };
}
