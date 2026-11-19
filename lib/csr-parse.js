/**
 * Minimal DER reader for PKCS#10 certificate signing requests.
 * Pulls out the subject, the public key type/size and the SAN names. No dependencies.
 */
function readTlv(buf, pos) {
  const tag = buf[pos];
  let len = buf[pos + 1];
  let hdr = 2;
  if (len & 0x80) {
    const n = len & 0x7f;
    if (n < 1 || n > 4) throw new Error('Unsupported length');
    len = 0;
    for (let i = 0; i < n; i++) len = len * 256 + buf[pos + 2 + i];
    hdr += n;
  }
  const start = pos + hdr;
  if (start + len > buf.length) throw new Error('Truncated data');
  return { tag, start, end: start + len, next: start + len };
}

function children(buf, tlv) {
  const out = [];
  let p = tlv.start;
  while (p < tlv.end) {
    const c = readTlv(buf, p);
    out.push(c);
    p = c.next;
  }
  return out;
}

function oidString(buf, t) {
  const b = buf.subarray(t.start, t.end);
  const parts = [Math.floor(b[0] / 40), b[0] % 40];
  let v = 0;
  for (let i = 1; i < b.length; i++) {
    v = v * 128 + (b[i] & 0x7f);
    if (!(b[i] & 0x80)) { parts.push(v); v = 0; }
  }
  return parts.join('.');
}

const NAMES = {
  '2.5.4.3': 'CN', '2.5.4.6': 'C', '2.5.4.7': 'L', '2.5.4.8': 'ST', '2.5.4.10': 'O', '2.5.4.11': 'OU',
  '1.2.840.113549.1.9.1': 'Email', '2.5.4.5': 'Serial'
};
const CURVES = { '1.2.840.10045.3.1.7': 'P-256', '1.3.132.0.34': 'P-384', '1.3.132.0.35': 'P-521' };

export function parseCsr(pem) {
  const b64 = String(pem || '').replace(/-----(BEGIN|END)[^-]+-----/g, '').replace(/\s+/g, '');
  if (!b64) throw new Error('Paste a CSR that starts with -----BEGIN CERTIFICATE REQUEST-----');
  const buf = Buffer.from(b64, 'base64');
  const root = readTlv(buf, 0);
  const [info] = children(buf, root);
  const [, subjectT, spkiT, attrsT] = children(buf, info);

  const subject = [];
  for (const rdn of children(buf, subjectT)) {
    for (const atv of children(buf, rdn)) {
      const [o, v] = children(buf, atv);
      const id = oidString(buf, o);
      subject.push({ key: NAMES[id] || id, value: buf.subarray(v.start, v.end).toString('utf8') });
    }
  }

  const [algT, keyBits] = children(buf, spkiT);
  const [algOid, param] = children(buf, algT);
  const alg = oidString(buf, algOid);
  let key = { type: alg, size: null };
  if (alg === '1.2.840.113549.1.1.1') {
    const inner = readTlv(buf, keyBits.start + 1);
    const [mod] = children(buf, inner);
    let n = mod.end - mod.start;
    if (buf[mod.start] === 0) n -= 1;
    key = { type: 'RSA', size: n * 8 };
  } else if (alg === '1.2.840.10045.2.1') {
    const curve = param ? oidString(buf, param) : '';
    key = { type: 'ECDSA', size: CURVES[curve] || curve };
  }

  const sans = [];
  if (attrsT && attrsT.tag === 0xa0) {
    for (const attr of children(buf, attrsT)) {
      const [o, set] = children(buf, attr);
      if (oidString(buf, o) !== '1.2.840.113549.1.9.14') continue;
      const [exts] = children(buf, set);
      for (const ext of children(buf, exts)) {
        const parts = children(buf, ext);
        if (oidString(buf, parts[0]) !== '2.5.29.17') continue;
        const octet = parts[parts.length - 1];
        const seq = readTlv(buf, octet.start);
        for (const g of children(buf, seq)) {
          if (g.tag === 0x82) sans.push(buf.subarray(g.start, g.end).toString('ascii'));
          if (g.tag === 0x87 && g.end - g.start === 4) sans.push(Array.from(buf.subarray(g.start, g.end)).join('.'));
        }
      }
    }
  }
  return { subject, key, sans };
}
