/**
 * Default knowledge base. Seeded into console.assist_articles on first use; the master
 * account edits them from Support → Knowledge base. Bodies use a small markdown subset:
 * **bold**, `code`, lines starting with "- " or "1. ", and blank lines between paragraphs.
 */
export const DEFAULT_ARTICLES = [
  {
    slug: 'validation-methods',
    title: 'How domain validation works',
    category: 'Validation',
    keywords: ['validate', 'dcv', 'dns', 'cname', 'txt', 'http', 'file', 'email', 'approval', 'pending'],
    body: `Before a certificate is issued, the certificate authority (CA) checks that you control the domain. You pick one of three methods:

- **DNS:** add the CNAME (or TXT) record shown on your certificate page at your DNS provider. Best for wildcards and when you can't change the website.
- **HTTP / HTTPS file:** upload the file shown on your certificate page to \`/.well-known/pki-validation/\` on the website, so it opens in a browser at the exact URL. Not allowed for wildcard certificates.
- **Email:** the CA sends an approval link to an address like admin@, administrator@, hostmaster@, postmaster@ or webmaster@ your domain. Open it and click approve.

Once the record or file is live, use **Ask the CA to re-check**. Most DV certificates are issued within minutes after that.`
  },
  {
    slug: 'dns-record-tips',
    title: 'DNS record not accepted? Common mistakes',
    category: 'Validation',
    keywords: ['dns record not working', 'dns record not accepted', 'cname not found', 'record has spaces', 'dns record wrong', 'domain added twice'],
    body: `Most DNS validation delays come from one of these:

- **Extra spaces or quotes** copied into the value. Paste the value exactly as shown, nothing before or after.
- **Domain added twice.** Many DNS panels add your domain automatically, so \`_abc.example.com\` becomes \`_abc.example.com.example.com\`. Enter only the part before your domain in the Name field.
- **Proxy on (Cloudflare).** Set the validation CNAME to **DNS only** (grey cloud).
- **Not propagated yet.** New records can take a few minutes, sometimes up to an hour. The assistant can check public DNS for you right now.

After fixing it, wait a few minutes and use **Ask the CA to re-check**.`
  },
  {
    slug: 'approval-email',
    title: 'Did not receive the approval email',
    category: 'Validation',
    keywords: ['approval email not received', 'validation email never came', 'no approval email', 'resend approval email', 'email in spam', 'admin@ mailbox'],
    body: `- Check the spam or junk folder of the approver address.
- The address must exist and receive mail. Only admin@, administrator@, hostmaster@, postmaster@ or webmaster@ your domain (or the WHOIS contact, where available) can be used.
- Use **Resend approval email** on the certificate page. The CA allows it once every few minutes.
- If the mailbox doesn't exist, switch the validation method to **DNS** or **HTTP file** instead.`
  },
  {
    slug: 'reissue-vs-renew',
    title: 'Reissue or renew: which one do I need?',
    category: 'Lifecycle',
    keywords: ['reissue or renew', 'reissue vs renew difference', 'difference between reissue and renew', 'subscription vs certificate expiry', 'when to reissue'],
    body: `Your order has two dates:

- **Certificate expiry:** public certificates are now limited to about 200 days. When the certificate nears expiry but your **subscription** (the period you paid for) is still running, you **reissue**. It's free and gives you a fresh certificate on the same order.
- **Subscription end:** when the period you paid for ends, you **renew**, which is a new order.

The certificate page always shows both dates and the right button.`
  },
  {
    slug: 'download-files',
    title: 'Downloading your certificate files',
    category: 'Install',
    keywords: ['download', 'zip', 'crt', 'ca bundle', 'fullchain', 'files'],
    body: `On the certificate page, use **Download all files (.zip)**. It contains:

- \`domain.crt\`: your server certificate
- \`domain.ca-bundle.crt\`: the intermediate CA certificates
- \`domain.fullchain.pem\`: certificate + intermediates in one file (Nginx and most servers)
- \`domain.csr\`: the request it was issued for

The **private key** is not included. It stays with you from when the CSR was created.`
  },
  {
    slug: 'install-nginx',
    title: 'Install on Nginx',
    category: 'Install',
    keywords: ['nginx', 'install', 'fullchain', 'ssl_certificate'],
    body: `1. Copy \`domain.fullchain.pem\` and your private key to the server, for example \`/etc/ssl/\`.
2. In the server block:
\`ssl_certificate /etc/ssl/domain.fullchain.pem;\`
\`ssl_certificate_key /etc/ssl/domain.key;\`
3. Test and reload: \`nginx -t && systemctl reload nginx\`

Use the full chain file, not only \`domain.crt\`, or some browsers and phones will show a chain error.`
  },
  {
    slug: 'install-apache',
    title: 'Install on Apache',
    category: 'Install',
    keywords: ['apache', 'httpd', 'install', 'sslcertificatefile'],
    body: `1. Copy \`domain.crt\`, \`domain.ca-bundle.crt\` and your private key to the server.
2. In the \`<VirtualHost *:443>\` block:
\`SSLCertificateFile /etc/ssl/domain.crt\`
\`SSLCertificateKeyFile /etc/ssl/domain.key\`
\`SSLCertificateChainFile /etc/ssl/domain.ca-bundle.crt\`
(On Apache 2.4.8 and later you can instead point SSLCertificateFile at \`domain.fullchain.pem\`.)
3. Test and reload: \`apachectl configtest && systemctl reload apache2\` (or \`httpd\`).`
  },
  {
    slug: 'install-iis',
    title: 'Install on IIS (Windows Server)',
    category: 'Install',
    keywords: ['iis', 'windows', 'pfx', 'install', 'bindings'],
    body: `IIS needs a **PFX** file (certificate + private key in one file).

1. Make a PFX with the **format converter** in Tools, using \`domain.crt\`, \`domain.ca-bundle.crt\` and your private key. Set a password.
2. In IIS Manager → your server → **Server Certificates** → **Import**, choose the PFX.
3. Open your site → **Bindings** → **https** → pick the new certificate.

If the CSR was created on the same Windows server, you can instead use **Complete Certificate Request** with \`domain.crt\`.`
  },
  {
    slug: 'install-cpanel',
    title: 'Install on cPanel',
    category: 'Install',
    keywords: ['cpanel', 'whm', 'install', 'hosting'],
    body: `1. In cPanel open **SSL/TLS** → **Manage SSL sites**.
2. Pick the domain, paste the contents of \`domain.crt\` into **Certificate (CRT)**.
3. Paste your private key into **Private Key (KEY)** (cPanel often fills it in if the CSR was made there).
4. Paste \`domain.ca-bundle.crt\` into **Certificate Authority Bundle (CABUNDLE)**.
5. Click **Install Certificate**.`
  },
  {
    slug: 'install-plesk',
    title: 'Install on Plesk',
    category: 'Install',
    keywords: ['plesk', 'install', 'hosting'],
    body: `1. Go to **Websites & Domains** → your domain → **SSL/TLS Certificates**.
2. Click **Upload certificate files** (or paste them): certificate = \`domain.crt\`, private key = your key, CA certificate = \`domain.ca-bundle.crt\`.
3. Go to **Hosting Settings** and select the new certificate for the site.`
  },
  {
    slug: 'install-tomcat',
    title: 'Install on Tomcat / Java (JKS or PKCS#12)',
    category: 'Install',
    keywords: ['tomcat', 'java', 'jks', 'keystore', 'pkcs12'],
    body: `1. Make a **PKCS#12 (.p12/.pfx)** or **JKS** file with the format converter in Tools, using your certificate, CA bundle and private key.
2. In \`server.xml\`, point the HTTPS connector at it, for example:
\`<Certificate certificateKeystoreFile="conf/domain.p12" certificateKeystorePassword="…" certificateKeystoreType="PKCS12" />\`
3. Restart Tomcat.`
  },
  {
    slug: 'convert-formats',
    title: 'PFX, P12, JKS and other formats',
    category: 'Install',
    keywords: ['pfx', 'p12', 'pkcs12', 'jks', 'p7b', 'der', 'convert'],
    body: `Use the **format converter** in Tools. It runs in your browser, so the private key never leaves your computer.

- **PFX / P12:** Windows, IIS, Azure, many Java servers. Needs the certificate, the CA bundle and the private key.
- **JKS:** older Java servers.
- **P7B:** certificate + chain without the key (some Windows and Java tools).
- **DER:** binary form of the certificate.`
  },
  {
    slug: 'lost-private-key',
    title: 'Lost the private key',
    category: 'Lifecycle',
    keywords: ['private key', 'lost', 'key', 'missing', 'deleted'],
    body: `The private key is created on your computer or server with the CSR. CertDesk and the CA never receive it, so it can't be downloaded again.

If it's lost, **reissue** the certificate: generate a new key and CSR on the reissue page. It's free while the subscription is running, and the old certificate keeps working until you replace it.`
  },
  {
    slug: 'what-is-csr',
    title: 'What is a CSR?',
    category: 'Ordering',
    keywords: ['csr', 'signing request', 'generate'],
    body: `A **CSR** (certificate signing request) is a small text block that contains your domain name and your public key. It starts with \`-----BEGIN CERTIFICATE REQUEST-----\`.

When you order or reissue in CertDesk, you can let your browser generate the key and CSR for you (the private key is saved to your computer only), or paste a CSR made on your server. The **CSR decoder** in Tools shows what's inside one.`
  },
  {
    slug: 'browser-errors',
    title: 'Browser shows "Not secure" or a certificate error',
    category: 'Troubleshooting',
    keywords: ['not secure', 'site shows not secure', 'your connection is not private', 'certificate error', 'name mismatch', 'untrusted certificate', 'err_cert_common_name_invalid', 'net::err_cert', 'privacy error'],
    body: `Run the **SSL checker** in Tools on your domain first. The usual causes:

- **Chain missing:** the server sends only \`domain.crt\`. Install the full chain (\`domain.fullchain.pem\`, or the CA bundle file).
- **Name mismatch:** the certificate doesn't cover the exact name you opened (for example \`www.\` vs without). Check the names on the certificate page, or reissue with the missing name.
- **Expired:** the old certificate is still installed. Install the newest one from the download page.
- **Mixed content:** the page is HTTPS but loads images or scripts over http://. Update those links on the site.`
  },
  {
    slug: 'certificate-lifetimes',
    title: 'Shorter certificate lifetimes (2026–2029)',
    category: 'Lifecycle',
    keywords: ['200 days', '100 days', '47 days', 'lifetime', '2027', '2029', 'ca/b forum'],
    body: `The CA/Browser Forum (ballot SC-081) is shortening the maximum lifetime of public TLS certificates:

- **From 15 March 2026:** up to 200 days
- **From 15 March 2027:** up to 100 days
- **From 15 March 2029:** up to 47 days

Your **subscription** can still run for a year or more. You just get a fresh certificate (a free reissue) more often. Automated subscriptions (Plan + Automate, ACME) do that for you.`
  },
  {
    slug: 'auto-renew',
    title: 'Auto-renew',
    category: 'Lifecycle',
    keywords: ['auto renew', 'automatic', 'renewal'],
    body: `Auto-renew is **off** by default. When it's on, a new subscription is ordered automatically when the current one ends. Turn it on or off on the certificate page under **Reminders & auto-renew**, or for many certificates at once by selecting them in **My certificates**.`
  },
  {
    slug: 'cancel-refund',
    title: 'Cancellations and refunds',
    category: 'Billing',
    keywords: ['cancel', 'refund', 'money back'],
    body: `Use **Cancel this order** at the bottom of the certificate page. Whether a refund is possible depends on the certificate authority's refund window (counted from the order date) and on whether the certificate was already issued. The support team confirms the outcome, usually within 1–2 business days.`
  },
  {
    slug: 'add-domains',
    title: 'Adding more domains to a certificate',
    category: 'Ordering',
    keywords: ['add domain', 'san', 'more domains', 'subdomain', 'multi-domain'],
    body: `Multi-domain certificates can cover extra names. Ask support to add domain slots to your order; once they're added, **reissue** and enter the new names. Single-domain certificates can't take extra names: order a multi-domain or wildcard certificate instead.`
  },
  {
    slug: 'caa-records',
    title: 'CAA records blocking issuance',
    category: 'Troubleshooting',
    keywords: ['caa', 'record', 'blocked', 'issue'],
    body: `A **CAA** DNS record lists which CAs may issue for your domain. If one exists and doesn't include your certificate's CA, issuance is blocked.

Add a CAA record for the right CA, for example \`0 issue "sectigo.com"\` for Sectigo brands or \`0 issue "digicert.com"\` for DigiCert, GeoTrust, RapidSSL and Thawte, then ask the CA to re-check.`
  }
];

import { MORE_ARTICLES } from './kb-more';
/** Everything the assistant ships with: the core set plus the extended library. */
export const ALL_ARTICLES = [...DEFAULT_ARTICLES, ...MORE_ARTICLES];
