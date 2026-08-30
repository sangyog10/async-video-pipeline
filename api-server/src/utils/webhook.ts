import { lookup } from "node:dns/promises";

const PRIVATE_IPV4_BLOCKS: [number, number][] = [
  [0x00000000, 8], // 0.0.0.0/8
  [0x0a000000, 8], // 10.0.0.0/8
  [0x7f000000, 8], // 127.0.0.0/8
  [0x64400000, 10], // 100.64.0.0/10 (CGNAT)
  [0xa9fe0000, 16], // 169.254.0.0/16 (link-local + AWS metadata)
  [0xac100000, 12], // 172.16.0.0/12
  [0xc0a80000, 16], // 192.168.0.0/16
];

const ipv4ToInt = (ip: string): number => {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return -1;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
};

const isPrivateIPv4 = (ip: string): boolean => {
  const int = ipv4ToInt(ip);
  if (int === -1) return true; // unparseable => treat as unsafe
  return PRIVATE_IPV4_BLOCKS.some(([base, prefix]) => {
    const mask = (0xffffffff << (32 - prefix)) >>> 0;
    return (int & mask) === (base & mask);
  });
};

const isPrivateIPv6 = (ip: string): boolean => {
  const lower = ip.toLowerCase();
  return (
    lower === "::1" ||
    lower.startsWith("fc") ||
    lower.startsWith("fd") || // fc00::/7
    lower.startsWith("fe8") ||
    lower.startsWith("fe9") ||
    lower.startsWith("fea") ||
    lower.startsWith("feb") || // fe80::/10
    lower.startsWith("::ffff:") // IPv4-mapped, checked separately
  );
};

const extractIPv4 = (address: string): string | null => {
  if (address.includes(".")) return address;
  const mapped = address.toLowerCase();
  if (mapped.startsWith("::ffff:") && mapped.includes(".")) {
    return mapped.slice(7);
  }
  return null;
};

/**
 * Reject webhook URLs that point at private/reserved networks.
 * Prevents SSRF against internal services, metadata endpoints, etc.
 */
export async function isSafeWebhookUrl(rawUrl: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }

  const hostname = url.hostname;
  if (hostname === "localhost") return false;

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0) return false;

    return addresses.every(({ address }) => {
      const ipv4 = extractIPv4(address);
      return ipv4 ? !isPrivateIPv4(ipv4) : !isPrivateIPv6(address);
    });
  } catch {
    return false; // DNS resolution failed
  }
}
