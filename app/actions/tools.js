'use server';

import crypto from 'node:crypto';
import tls from 'node:tls';
import dns from 'node:dns/promises';
import net from 'node:net';
import { requireWorkspace } from '@/lib/auth';
import { parseCsr } from '@/lib/csr-parse';

const days = (d) => Math.round((new Date(d).getTime() - Date.now()) / 86400000);

function certSummary(x) {
  const pick = (dn, k) => (String(dn || '').split('\n').find((l) => l.startsWith(k + '=')) || '').slice(k.length + 1) || null;
  const sans = String(x.subjectAltName || '').split(', ').filter(Boolean).map((s) => s.replace(/^(DNS|IP Address):/, ''));
  const pk = x.publicKey;
  const det = pk.asymmetricKeyDetails || {};
  return {
    cn: pick(x.subject, 'CN'),
    org: pick(x.subject, 'O'),
    issuer: pick(x.issuer, 'O') || pick(x.issuer, 'CN'),
    issuerCn: pick(x.issuer, 'CN'),
    sans,
    validFrom: new Date(x.validFrom).toISOString(),
    validTo: new Date(x.validTo).toISOString(),
    daysLeft: days(x.validTo),
    serial: x.serialNumber,
    key: pk.asymmetricKeyType === 'rsa' ? `RSA ${det.modulusLength}` : pk.asymmetricKeyType === 'ec' ? `ECDSA ${det.namedCurve || ''}`.trim() : pk.asymmetricKeyType,
    sha256: x.fingerprint256,
    selfSigned: x.subject === x.issuer
  };
}

export async function decodeCsrTool(_prev, form) {
  await requireWorkspace();
  const pem = String(form.get('csr') || '');
  try {
    const r = parseCsr(pem);
    return { ok: true, ...r, pem };
  } catch (e) {
    return { error: 'That does not look like a valid CSR. Paste the whole block, including the BEGIN and END lines.', pem };
  }
}

export async function decodeCertTool(_prev, form) {
  await requireWorkspace();
  const pem = String(form.get('cert') || '');
  const blocks = pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];
  if (!blocks.length) return { error: 'Paste a certificate that starts with -----BEGIN CERTIFICATE-----', pem };
  try {
    return { ok: true, certs: blocks.map((b) => certSummary(new crypto.X509Certificate(b))), pem };
  } catch {
    return { error: 'The certificate could not be read. Check that it was pasted completely.', pem };
  }
}

function isPrivate(ip) {
  if (net.isIPv6(ip)) return /^(::1|fc|fd|fe80|::ffff:(10|127|192\.168|169\.254)\.)/i.test(ip) || ip === '::';
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

export async function checkSslTool(_prev, form) {
  await requireWorkspace();
  const raw = String(form.get('host') || '').trim().toLowerCase();
  const host = raw.replace(/^https?:\/\//, '').split(/[/?#]/)[0].replace(/:\d+$/, '');
  if (!/^(?=.{1,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(host)) return { error: 'Enter a domain name like www.example.com', host: raw };
  let address;
  try {
    ({ address } = await dns.lookup(host));
  } catch {
    return { error: `${host} does not resolve in DNS.`, host };
  }
  if (isPrivate(address)) return { error: 'That address is not public.', host };

  const started = Date.now();
  try {
    const res = await new Promise((resolve, reject) => {
      const sock = tls.connect({ host: address, port: 443, servername: host, rejectUnauthorized: false, timeout: 8000 }, () => {
        const chain = [];
        let c = sock.getPeerCertificate(true);
        const seen = new Set();
        while (c && c.raw && !seen.has(c.fingerprint256)) {
          seen.add(c.fingerprint256);
          chain.push(certSummary(new crypto.X509Certificate(c.raw)));
          c = c.issuerCertificate;
        }
        const out = { authorized: sock.authorized, reason: sock.authorizationError ? String(sock.authorizationError) : null, protocol: sock.getProtocol(), cipher: sock.getCipher()?.name, chain };
        sock.end();
        resolve(out);
      });
      sock.on('timeout', () => { sock.destroy(); reject(new Error('Timed out connecting on port 443.')); });
      sock.on('error', (e) => reject(e));
    });
    const leaf = res.chain[0];
    const names = leaf ? [leaf.cn, ...leaf.sans].filter(Boolean) : [];
    const covers = names.some((n) => n === host || (n.startsWith('*.') && host.endsWith(n.slice(1)) && host.split('.').length === n.split('.').length));
    return { ok: true, host, ip: address, ms: Date.now() - started, covers, ...res };
  } catch (e) {
    return { error: `Could not connect to ${host} on port 443: ${e.message}`, host };
  }
}
