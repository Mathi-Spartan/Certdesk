// Builds a PKCS#10 CSR with WebCrypto. The private key never leaves the browser.

function len(n) {
  if (n < 0x80) return [n];
  const bytes = [];
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  return [0x80 | bytes.length, ...bytes];
}

function tlv(tag, content) {
  const c = Array.from(content);
  return [tag, ...len(c.length), ...c];
}

const seq = (...items) => tlv(0x30, items.flat());
const set = (...items) => tlv(0x31, items.flat());
const int = (bytes) => {
  let b = Array.from(bytes);
  while (b.length > 1 && b[0] === 0 && b[1] < 0x80) b = b.slice(1);
  if (b[0] >= 0x80) b = [0, ...b];
  return tlv(0x02, b);
};
const bitString = (bytes) => tlv(0x03, [0, ...bytes]);
const utf8 = (s) => tlv(0x0c, Array.from(new TextEncoder().encode(s)));
const printable = (s) => tlv(0x13, Array.from(new TextEncoder().encode(s)));
const NULL = [0x05, 0x00];

function oid(str) {
  const parts = str.split('.').map(Number);
  const out = [parts[0] * 40 + parts[1]];
  for (const p of parts.slice(2)) {
    const stack = [p & 0x7f];
    let v = p >> 7;
    while (v > 0) {
      stack.unshift((v & 0x7f) | 0x80);
      v >>= 7;
    }
    out.push(...stack);
  }
  return tlv(0x06, out);
}

function name({ cn, o, ou, l, st, c }) {
  const rdn = [];
  if (c) rdn.push(set(seq(oid('2.5.4.6'), printable(c.toUpperCase().slice(0, 2)))));
  if (st) rdn.push(set(seq(oid('2.5.4.8'), utf8(st))));
  if (l) rdn.push(set(seq(oid('2.5.4.7'), utf8(l))));
  if (o) rdn.push(set(seq(oid('2.5.4.10'), utf8(o))));
  if (ou) rdn.push(set(seq(oid('2.5.4.11'), utf8(ou))));
  rdn.push(set(seq(oid('2.5.4.3'), utf8(cn))));
  return seq(...rdn);
}

function sanExtensionRequest(names) {
  if (!names.length) return tlv(0xa0, []);
  const general = names.map((n) => tlv(0x82, Array.from(new TextEncoder().encode(n))));
  const ext = seq(oid('2.5.29.17'), tlv(0x04, seq(...general)));
  const extReq = seq(oid('1.2.840.113549.1.9.14'), set(seq(ext)));
  return tlv(0xa0, extReq);
}

function rawEcdsaToDer(sig) {
  const b = new Uint8Array(sig);
  const half = b.length / 2;
  return seq(int(b.slice(0, half)), int(b.slice(half)));
}

function toPem(label, bytes) {
  let bin = '';
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  const b64 = btoa(bin).match(/.{1,64}/g).join('\n');
  return `-----BEGIN ${label}-----\n${b64}\n-----END ${label}-----\n`;
}

/**
 * @param {{cn:string, sans?:string[], o?:string, ou?:string, l?:string, st?:string, c?:string, keyType?:'ec'|'rsa2048'|'rsa4096'}} subject
 * @param {Crypto} [cryptoImpl]
 * @returns {Promise<{csr:string, privateKey:string}>}
 */
export async function generateCsr(subject, cryptoImpl = globalThis.crypto) {
  const subtle = cryptoImpl.subtle;
  const isEc = (subject.keyType || 'ec') === 'ec';
  const algo = isEc
    ? { name: 'ECDSA', namedCurve: 'P-256' }
    : { name: 'RSASSA-PKCS1-v1_5', modulusLength: subject.keyType === 'rsa4096' ? 4096 : 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' };
  const keys = await subtle.generateKey(algo, true, ['sign', 'verify']);
  const spki = Array.from(new Uint8Array(await subtle.exportKey('spki', keys.publicKey)));
  const sans = [subject.cn, ...(subject.sans || [])].filter((v, i, a) => v && a.indexOf(v) === i);
  const info = seq(int([0]), name(subject), spki, sanExtensionRequest(sans));
  const signAlgo = isEc ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'RSASSA-PKCS1-v1_5' };
  const sig = await subtle.sign(signAlgo, keys.privateKey, new Uint8Array(info));
  const sigAlg = isEc ? seq(oid('1.2.840.10045.4.3.2')) : seq(oid('1.2.840.113549.1.1.11'), NULL);
  const sigBytes = isEc ? rawEcdsaToDer(sig) : Array.from(new Uint8Array(sig));
  const csr = seq(info, sigAlg, bitString(sigBytes));
  const pkcs8 = await subtle.exportKey('pkcs8', keys.privateKey);
  return { csr: toPem('CERTIFICATE REQUEST', new Uint8Array(csr)), privateKey: toPem('PRIVATE KEY', pkcs8) };
}
