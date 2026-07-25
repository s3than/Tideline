import { isIP } from 'node:net';
import { lookup as dnsLookup } from 'node:dns/promises';

export function isBlockedAddress(ip: string, allowLocalhost = false): boolean {
  if (!allowLocalhost) {
    if (ip === '::1' || ip.startsWith('127.')) return true;
  }
  // Link-local always blocked — covers AWS/GCP/Azure IMDS and fe80::/10
  if (ip.startsWith('169.254.')) return true;
  if (/^fe[89ab][0-9a-f]/i.test(ip)) return true;
  return false;
}

export function resolveAllowWebhookLocalhost(): boolean {
  return (
    process.env.ALLOW_WEBHOOK_LOCALHOST === 'true' || process.env.ALLOW_WEBHOOK_LOCALHOST === '1'
  );
}

export async function resolveBlocked(
  hostname: string,
  allowLocalhost = false,
): Promise<string | null> {
  const ip =
    isIP(hostname) !== 0 ? hostname : (await dnsLookup(hostname).catch(() => null))?.address;
  return ip && isBlockedAddress(ip, allowLocalhost) ? ip : null;
}
