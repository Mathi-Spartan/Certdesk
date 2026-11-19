/**
 * Look up the DCV record in public DNS (Google DNS-over-HTTPS) and compare it with what
 * the CA expects, so the customer gets a precise answer instead of "still pending".
 */
const clean = (v) => String(v || '').replace(/^"+|"+$/g, '').trim().replace(/\.$/, '').toLowerCase();

export async function checkDcvRecord(rec) {
  if (!rec?.name || !rec?.type || !rec?.value) return null;
  const type = rec.type.toUpperCase();
  try {
    const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(rec.name)}&type=${type}`, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
    const j = await r.json();
    const want = clean(rec.value);
    const found = (j.Answer || []).filter((a) => a.type === (type === 'TXT' ? 16 : 5)).map((a) => String(a.data));
    // TXT data comes back quoted; strip only the outer quotes so stray spaces stay visible.
    const raw = found.map((d) => d.replace(/^"|"$/g, '').replace(/\.$/, ''));
    if (raw.some((d) => d.toLowerCase() === want)) return { state: 'ok', found: raw };
    const near = raw.find((d) => clean(d) === want);
    if (near !== undefined) return { state: 'malformed', found: raw, near };
    return { state: 'missing', found: raw };
  } catch {
    return null;
  }
}

export function dnsMessage(rec, res) {
  if (!res) return null;
  if (res.state === 'ok') return `The ${rec.type} record at ${rec.name} is correct in public DNS. Use "Ask the CA to re-check" if the certificate is not issued within a few minutes.`;
  if (res.state === 'malformed') return `The ${rec.type} record at ${rec.name} has extra spaces or quotes: [${res.near}]. Edit it to exactly ${rec.value}, then ask the CA to re-check.`;
  return `The ${rec.type} record at ${rec.name} with value ${rec.value} is not in public DNS yet${res.found.length ? ` (found ${res.found.length} other ${rec.type} record${res.found.length > 1 ? 's' : ''})` : ''}. Add it, wait a few minutes, then check again.`;
}
