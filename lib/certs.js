import crypto from 'node:crypto';

function splitPem(text) {
  return String(text || '').match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];
}

export function leafPem(order) {
  return splitPem(order.crt_code)[0] || null;
}

export function chainPem(order) {
  return splitPem(order.ca_code).join('\n');
}

export function fullchainPem(order) {
  const leaf = leafPem(order);
  if (!leaf) return null;
  const chain = chainPem(order);
  return chain ? `${leaf}\n${chain}\n` : `${leaf}\n`;
}

/** Facts read from the issued certificate itself. */
export function certFacts(order) {
  const pem = leafPem(order);
  if (!pem) return null;
  try {
    const x = new crypto.X509Certificate(pem);
    const key = x.publicKey.asymmetricKeyDetails || {};
    const keyType = x.publicKey.asymmetricKeyType;
    return {
      serial: x.serialNumber,
      issuer: (x.issuer.match(/CN=([^\n]+)/) || [])[1] || x.issuer,
      validFrom: x.validFrom,
      validTo: x.validTo,
      fingerprint256: x.fingerprint256,
      san: (x.subjectAltName || '').split(',').map((s) => s.trim().replace(/^DNS:/, '')).filter(Boolean),
      key: keyType === 'ec' ? `ECDSA ${key.namedCurve || ''}`.trim() : keyType === 'rsa' ? `RSA ${key.modulusLength || ''}`.trim() : keyType
    };
  } catch {
    return null;
  }
}
