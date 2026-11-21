import { lookup } from "node:dns/promises";
import ipaddr from "ipaddr.js";
import { Agent, fetch as undiciFetch } from "undici";

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export interface SafePageResponse {
  status: number;
  location: string | null;
  contentType: string | null;
  body: string;
}

export interface SafePageFetcherDependencies {
  resolveHost(hostname: string): Promise<ResolvedAddress[]>;
  request(
    url: string,
    address: ResolvedAddress,
    signal: AbortSignal,
  ): Promise<SafePageResponse>;
}

const maxRedirects = 5;
const maxResponseBytes = 1_000_000;
const redirectStatuses = new Set([301, 302, 303, 307, 308]);

function isPublicAddress(address: string): boolean {
  try {
    return ipaddr.process(address).range() === "unicast";
  } catch {
    return false;
  }
}

function validateUrl(value: string): URL {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase();
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    (url.port !== "" && url.port !== "80" && url.port !== "443") ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("Only public HTTP or HTTPS recipe pages can be fetched");
  }
  return url;
}

async function resolvePublicAddress(
  url: URL,
  resolveHost: SafePageFetcherDependencies["resolveHost"],
): Promise<ResolvedAddress> {
  const addresses = ipaddr.isValid(url.hostname)
    ? [
        {
          address: url.hostname,
          family: ipaddr.process(url.hostname).kind() === "ipv4" ? 4 : 6,
        } satisfies ResolvedAddress,
      ]
    : await resolveHost(url.hostname);

  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => !isPublicAddress(address))
  ) {
    throw new Error("Recipe pages must resolve to a public internet address");
  }
  return addresses[0];
}

async function readLimited(response: {
  headers: { get(name: string): string | null };
  body: {
    getReader(): {
      read(): Promise<{ done: boolean; value?: Uint8Array }>;
      cancel(): Promise<void>;
    };
  } | null;
}): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > maxResponseBytes) {
    throw new Error("The recipe page is too large to import");
  }

  const reader = response.body?.getReader();
  if (!reader) return "";

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > maxResponseBytes) {
      await reader.cancel();
      throw new Error("The recipe page is too large to import");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

async function requestPinned(
  value: string,
  address: ResolvedAddress,
  signal: AbortSignal,
): Promise<SafePageResponse> {
  const hostname = new URL(value).hostname;
  const dispatcher = new Agent({
    connect: {
      lookup: (requestedHost, options, callback) => {
        if (requestedHost !== hostname) {
          callback(new Error("Unexpected recipe page host"), "", 0);
          return;
        }
        if (typeof options === "object" && options !== null && options.all) {
          callback(null, [address]);
          return;
        }
        callback(null, address.address, address.family);
      },
    },
  });

  try {
    const response = await undiciFetch(value, {
      dispatcher,
      redirect: "manual",
      signal,
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "RecipeLibrary/1.0 (+recipe page import)",
      },
    });
    return {
      status: response.status,
      location: response.headers.get("location"),
      contentType: response.headers.get("content-type"),
      body: await readLimited(response),
    };
  } finally {
    await dispatcher.close();
  }
}

export function createSafePageFetcher(
  dependencies: SafePageFetcherDependencies = {
    resolveHost: async (hostname) => {
      const results = await lookup(hostname, { all: true, verbatim: true });
      return results.flatMap(({ address, family }) =>
        family === 4 || family === 6 ? [{ address, family }] : [],
      );
    },
    request: requestPinned,
  },
): (value: string) => Promise<string> {
  return async (value) => {
    let current = validateUrl(value);
    const visited = new Set<string>();
    const signal = AbortSignal.timeout(15_000);

    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      const serialized = current.toString();
      if (visited.has(serialized)) throw new Error("The recipe page redirected in a loop");
      visited.add(serialized);

      const address = await resolvePublicAddress(current, dependencies.resolveHost);
      const response = await dependencies.request(
        serialized,
        address,
        signal,
      );

      if (redirectStatuses.has(response.status)) {
        if (!response.location || redirectCount === maxRedirects) {
          throw new Error("The recipe page redirected too many times");
        }
        current = validateUrl(new URL(response.location, current).toString());
        continue;
      }
      if (response.status < 200 || response.status >= 300) {
        throw new Error("The recipe website could not be fetched");
      }
      const contentType = response.contentType?.split(";", 1)[0].trim().toLowerCase();
      if (contentType !== "text/html" && contentType !== "application/xhtml+xml") {
        throw new Error("The source URL does not point to an HTML recipe page");
      }
      return response.body;
    }

    throw new Error("The recipe page redirected too many times");
  };
}
