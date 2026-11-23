/**
 * Extended knowledge base. Each article lists the ways customers actually ask the question in
 * `keywords`; the matcher compares a message with the title and every keyword phrase.
 * Links in bodies use [label](/path) and only internal paths are rendered as links.
 */
export const MORE_ARTICLES = [
  // ───────────── Validation
  {
    slug: 'cname-vs-txt', title: 'CNAME or TXT record: which one do I add?', category: 'Validation',
    keywords: ['cname or txt', 'txt record instead of cname', 'which dns record type', 'can i use txt', 'record type for validation', 'cname txt difference'],
    body: `Add the record **type shown on your certificate page**. Most orders use a **CNAME** (name like \`_abc123.example.com\` pointing to a value ending in the CA's domain). Some brands give a **TXT** record instead.

- Don't swap one type for the other: the CA only checks the type it asked for.
- You can't have a CNAME and another record with the same name, so remove any old record with that name first.`
  },
  {
    slug: 'http-file-404', title: 'HTTP file validation: file not found or not accepted', category: 'Validation',
    keywords: ['http file not found', '404 validation file', 'file validation failed', 'pki-validation folder', 'where to upload validation file', 'well-known folder', 'http validation not working', 'file upload validation'],
    body: `The file must open at **exactly** the URL on your certificate page, for example \`http://example.com/.well-known/pki-validation/ABC123.txt\`.

- Create the folders \`.well-known\` and \`pki-validation\` in the website's root folder (names start with a dot).
- Open the URL in a browser: you should see the file content, not a 404 or a login page.
- **No redirects:** the CA may not follow a redirect to another host or to https. Temporarily allow plain http for that path if needed.
- Firewalls, Cloudflare "Under attack" mode or geo-blocking can block the CA. Allow the request or use **DNS** validation instead.
- On Windows/IIS, add a MIME type for the file if it doesn't open.`
  },
  {
    slug: 'wildcard-validation', title: 'How to validate a wildcard certificate', category: 'Validation',
    keywords: ['wildcard validation', 'validate wildcard', 'wildcard http file', 'wildcard dns', 'star domain validation', '*.domain validation'],
    body: `Wildcard certificates (\`*.example.com\`) can only be validated by **DNS** or **approver email**. HTTP/HTTPS file validation isn't allowed for wildcards by industry rules.

Use **Change validation method** on the certificate page and pick DNS (CNAME), then add the record shown.`
  },
  {
    slug: 'validation-time', title: 'How long does validation and issuance take?', category: 'Validation',
    keywords: ['how many days does ov take', 'how long for ev', 'how long does it take', 'how long to issue', 'issuance time', 'when will i get my certificate', 'how much time validation', 'validation time', 'eta for certificate'],
    body: `- **DV (domain validated):** usually **within minutes** after the DNS record, file or approval email is in place.
- **OV (organisation validated):** usually **1–3 business days**, after the CA has verified your company and done a call-back.
- **EV (extended validation):** usually **1–5 business days**, with more checks.

Delays mostly come from a wrong DNS record, a blocked validation file or unanswered call-backs. Ask me "why is my certificate not issued" to check yours live.`
  },
  {
    slug: 'www-coverage', title: 'Does my certificate cover www and the bare domain?', category: 'Validation',
    keywords: ['www and non www', 'does it cover www', 'example.com and www.example.com', 'bare domain', 'root domain covered', 'without www'],
    body: `Most single-domain DV/OV certificates cover **both** \`example.com\` and \`www.example.com\` when you order for one of them. Some brands only add the other name if it validates too.

Check the names under **Names on this certificate** on the certificate page, or ask me "is www.example.com covered" and I'll check your orders.`
  },
  {
    slug: 'cloudflare-dns', title: 'Using Cloudflare for DNS validation', category: 'Validation',
    keywords: ['cloudflare', 'cloudflare cname', 'cloudflare proxy', 'orange cloud', 'grey cloud', 'cloudflare validation not working'],
    body: `In Cloudflare → **DNS** → **Add record**:

1. Type: the type shown on your certificate page (usually CNAME).
2. Name: only the part **before** your domain (Cloudflare adds the domain).
3. Target: the value, exactly as shown.
4. Proxy status: **DNS only (grey cloud)**. A proxied (orange) record won't validate.

If your site sits behind Cloudflare, set SSL/TLS mode to **Full (strict)** after installing the certificate on your server.`
  },
  {
    slug: 'dns-provider-tips', title: 'Adding the DNS record at GoDaddy, Namecheap, Route 53 and others', category: 'Validation',
    keywords: ['godaddy', 'namecheap', 'route 53', 'route53', 'bigrock', 'hostinger dns', 'where to add dns record', 'how to add cname', 'dns panel'],
    body: `The steps are similar everywhere: open the domain's **DNS / Zone editor** and add a record.

- **GoDaddy, Namecheap, BigRock, Hostinger:** in "Host/Name" enter only the part before your domain; the panel adds the rest.
- **AWS Route 53:** enter the full name; Route 53 shows the domain suffix greyed out, so paste only the prefix into the box.
- **cPanel Zone Editor:** you can enter the full name ending with a dot.

After saving, ask me to **check my DNS**. I'll look it up in public DNS and tell you if it's right.`
  },
  {
    slug: 'recheck-limit', title: 'Why can I only re-check every few minutes?', category: 'Validation',
    keywords: ['recheck limit', 'try again in minutes', 're-check disabled', 'revalidate wait', 'why wait to recheck', 'button locked'],
    body: `The CA allows a validation re-check **about once every 5 minutes per order** to protect their systems. The button shows a countdown when it's locked.

Use the wait to confirm your record is live: ask me "check my DNS" and I'll test it right away, without using up the CA's re-check.`
  },
  {
    slug: 'dcv-reuse', title: 'Do I have to validate my domain every time?', category: 'Validation',
    keywords: ['validate again', 'validation reuse', 'why validate every time', 'domain validation again on reissue', 'revalidate on renewal'],
    body: `A completed domain validation can be **reused for a limited time**, so quick reissues often don't need it again. That reuse window is shrinking under the CA/Browser Forum rules (ballot SC-081), so expect to validate more often over 2026–2029.

The easiest way to stop worrying about it: keep the **DNS CNAME** record in place permanently, or use an automated (ACME / Plan + Automate) subscription.`
  },

  // ───────────── OV / EV
  {
    slug: 'ov-requirements', title: 'What is needed for OV (organisation) validation?', category: 'OV & EV',
    keywords: ['ov validation', 'organization validation', 'organisation validation documents', 'ov documents', 'company verification', 'business validation'],
    body: `For OV, the CA checks your organisation as well as the domain:

- The organisation's legal name, address and phone number must be listed in a **government registry or a trusted directory** (for example Dun & Bradstreet, or an official company register).
- A **call-back** to a verified phone number of the organisation.
- Domain validation, as for DV.

If your details aren't listed, the CA may ask for a registration document or a professional opinion letter.`
  },
  {
    slug: 'ev-requirements', title: 'What is needed for EV (extended validation)?', category: 'OV & EV',
    keywords: ['ev validation', 'extended validation', 'ev documents', 'ev requirements', 'green bar'],
    body: `EV includes everything in OV, plus stricter checks:

- The organisation must be **active and registered** for a period, with a verifiable physical address.
- Verification of the person requesting and approving the certificate (often a signed EV agreement and a call-back).
- Usually 1–5 business days once documents are complete.

Modern browsers no longer show a green bar, but the organisation name stays in the certificate details.`
  },
  {
    slug: 'callback', title: 'The CA wants to call us (call-back verification)', category: 'OV & EV',
    keywords: ['callback', 'call back', 'phone verification', 'ca will call', 'verification call', 'missed call from ca'],
    body: `For OV and EV, the CA calls a **verified phone number** of your organisation (from a public registry or directory, not just the number you typed in the order) to confirm the request.

Make sure that number reaches someone who knows about the order. If you missed the call, ask the support team and we'll ask the CA to schedule it again.`
  },
  {
    slug: 'org-change', title: 'Changing the company name or details on a certificate', category: 'OV & EV',
    keywords: ['change company name', 'change organization', 'wrong company name', 'update address on certificate', 'change org details'],
    body: `Organisation details in an OV/EV certificate are verified by the CA, so changing them needs **new organisation validation**. Usually that means a new order; some brands allow it on reissue with fresh documents.

Talk to support with the new details and we'll tell you the quickest route for your brand.`
  },

  // ───────────── Choosing & ordering
  {
    slug: 'dv-ov-ev', title: 'DV, OV or EV: what is the difference?', category: 'Ordering',
    keywords: ['dv vs ov', 'ov vs ev', 'difference between dv ov ev', 'which validation level', 'domain validation vs organization', 'what is dv'],
    body: `All three give the **same encryption**. The difference is what the CA checks:

- **DV:** only that you control the domain. Minutes to issue. Great for blogs, apps, internal tools on public names.
- **OV:** also verifies your organisation; its name appears in the certificate. 1–3 days. Good for business sites and APIs.
- **EV:** the strictest organisation checks. 1–5 days. For banks, payments and high-trust brands.

Not sure? The [SSL Finder](/tools/finder) asks a few questions and suggests one.`
  },
  {
    slug: 'wildcard-scope', title: 'What does a wildcard certificate cover?', category: 'Ordering',
    keywords: ['what is wildcard', 'wildcard cover', 'does wildcard cover root', 'wildcard subdomains', 'wildcard second level', 'sub sub domain'],
    body: `\`*.example.com\` covers **one level** of subdomains: \`www.example.com\`, \`shop.example.com\`, \`api.example.com\`…

- It does **not** cover \`a.b.example.com\` (two levels deep). You'd need \`*.b.example.com\`.
- Most brands also include the bare \`example.com\` automatically; check the names on your certificate page.`
  },
  {
    slug: 'multidomain', title: 'What is a multi-domain (SAN/UCC) certificate?', category: 'Ordering',
    keywords: ['wildcard vs multi domain', 'difference wildcard multi domain', 'multi domain', 'san certificate', 'ucc certificate', 'multiple domains one certificate', 'different domains one cert'],
    body: `One certificate that covers **several different names**, for example \`example.com\`, \`example.in\` and \`mail.otherbrand.com\`. Each name is validated separately.

Extra names can usually be added later: support adds the domain slots, then you **reissue** with the new names. Some brands also offer multi-domain **wildcard** certificates.`
  },
  {
    slug: 'which-to-buy', title: 'Which certificate should I buy?', category: 'Ordering',
    keywords: ['which certificate to buy', 'recommend certificate', 'best ssl for me', 'help me choose', 'cheapest ssl', 'which ssl is best'],
    body: `A quick guide:

- One website, fast: **DV single-domain**.
- Many subdomains: **DV wildcard**.
- Several different domains: **multi-domain**.
- Business or customer-facing app: **OV** (add wildcard or multi-domain as needed).
- Banking, payments, high trust: **EV**.

The [SSL Finder](/tools/finder) asks a few questions and picks for you.`
  },
  {
    slug: 'how-to-order', title: 'How do I order a new certificate?', category: 'Ordering',
    keywords: ['how to order', 'place an order', 'buy a certificate steps', 'new certificate order', 'order process'],
    body: `1. Open [Order new certificate](/order) and pick the certificate.
2. Choose the period and enter your domain.
3. Generate a key and CSR in your browser (or upload/paste your own CSR).
4. Choose how to validate: DNS, HTTP file or email.
5. Place the order, then complete validation. I can walk you through it and check it live.`
  },
  {
    slug: 'subscription-periods', title: 'Subscription periods and free reissues', category: 'Ordering',
    keywords: ['1 year 2 year 3 year', 'multi year', 'subscription length', 'how many years', 'multi-year plan', 'longer validity'],
    body: `Certificates themselves are limited to a maximum lifetime (about 200 days from March 2026, shorter later). A **multi-year subscription** gives you fresh certificates over that whole period: you **reissue for free** whenever the current certificate nears expiry, until the subscription ends.`
  },
  {
    slug: 'unlimited-reissues', title: 'How many times can I reissue?', category: 'Lifecycle',
    keywords: ['how many reissues', 'reissue limit', 'is reissue free', 'reissue cost', 'reissue charge', 'unlimited reissue'],
    body: `Reissues are **free** and you can reissue **as many times as you need** while the subscription runs (for a new key, changed server, extra names you've added, or when the certificate nears expiry).

Only one reissue can be in progress at a time: finish the current one before starting another.`
  },
  {
    slug: 'ip-and-internal-names', title: 'Certificates for IP addresses, localhost or internal names', category: 'Ordering',
    keywords: ['ip address certificate', 'ssl for ip', 'localhost ssl', 'internal domain', 'intranet certificate', '.local domain', 'private ip'],
    body: `Public CAs **can't** issue for internal names (\`server.local\`, \`intranet\`), \`localhost\` or private IPs (10.x, 192.168.x).

- **Public IP addresses:** some brands offer OV certificates for public IPs. Ask support.
- **Internal systems:** use a public subdomain (like \`intranet.example.com\`) with DNS validation, or a private CA.`
  },
  {
    slug: 'code-signing', title: 'Code signing and other certificate types', category: 'Ordering',
    keywords: ['code signing', 'sign software', 'sign exe', 'document signing', 'email certificate', 'smime', 's/mime', 'client certificate'],
    body: `Code signing, document signing and S/MIME (email) certificates need extra identity checks, and code-signing keys must be kept on a hardware token or cloud HSM.

Some of these are shown as "coming soon" in the order page. Contact the support team and we'll arrange the right one for you.`
  },
  {
    slug: 'prices-invoices', title: 'Prices, payments and invoices', category: 'Billing',
    keywords: ['price', 'pricing', 'invoice', 'bill', 'gst invoice', 'payment', 'how to pay', 'quotation', 'quote'],
    body: `Prices for your account are shown on the order page for the certificates enabled for you. For invoices, quotations, GST details or payment questions, send a message to the support team. They'll reply in this chat.`
  },

  // ───────────── Lifecycle
  {
    slug: 'expired-what-now', title: 'My certificate has expired. What now?', category: 'Lifecycle',
    keywords: ['certificate expired', 'ssl expired', 'site shows expired', 'expired what to do', 'cert ran out'],
    body: `Visitors see a warning until a new certificate is installed.

- If your **subscription is still running**: **reissue** (free), validate, then install the new certificate.
- If the **subscription has ended**: **renew** (a new order).

Ask me "reissue or renew" and I'll tell you which one applies to your certificate.`
  },
  {
    slug: 'renew-when', title: 'When should I renew?', category: 'Lifecycle',
    keywords: ['when to renew', 'renew early', 'renew before expiry', 'renewal window', 'how early can i renew'],
    body: `Renew when the **subscription** (the period you paid for) is close to ending. The certificate page and the "Due in the next 30 days" list show it. Renewing is a new order with its own validation, so start a week or two before the end to avoid a gap.

If only the **certificate** is expiring while the subscription still runs, you **reissue** instead. It's free.`
  },
  {
    slug: 'revoke', title: 'How do I revoke a certificate?', category: 'Lifecycle',
    keywords: ['revoke', 'revocation', 'revoke certificate', 'invalidate certificate', 'cancel issued certificate'],
    body: `Revoking makes a certificate invalid **immediately and permanently**. Browsers will reject it. Do it if the private key was exposed or the certificate shouldn't exist.

Ask the support team to revoke and tell them the reason. If you still need a certificate, **reissue** with a new key first, install it, then revoke the old one.`
  },
  {
    slug: 'key-compromised', title: 'My private key was leaked or compromised', category: 'Lifecycle',
    keywords: ['key compromised', 'private key leaked', 'key exposed', 'hacked server', 'key stolen', 'security incident'],
    body: `Act quickly:

1. **Reissue** the certificate with a **new key** (free while the subscription runs) and install it.
2. Ask support to **revoke** the old certificate, reason "key compromise".
3. Remove the old key from all servers and backups you no longer control.`
  },
  {
    slug: 'change-domain', title: 'Can I change the domain on my certificate?', category: 'Lifecycle',
    keywords: ['change domain', 'wrong domain', 'change common name', 'typo in domain', 'move to another domain'],
    body: `The main domain usually **can't** be changed on a reissue. A different main domain needs a new order. Some brands allow it within the first days of the order; ask support quickly if you made a typo.

On **multi-domain** certificates you can swap the additional names when you reissue.`
  },
  {
    slug: 'move-server', title: 'Moving a certificate to another server', category: 'Install',
    keywords: ['move certificate', 'new server', 'migrate ssl', 'transfer certificate', 'export certificate', 'change hosting'],
    body: `You need the **certificate files** (download the ZIP any time) and the **private key** from the old server.

- Copy both to the new server and install as usual.
- Windows/IIS: export a **PFX** from the old server (with the key) and import it on the new one.
- Lost the key? **Reissue** with a new key and CSR for the new server. It's free.`
  },
  {
    slug: 'multiple-servers', title: 'Can I use one certificate on several servers?', category: 'Install',
    keywords: ['multiple servers', 'same certificate two servers', 'load balancer', 'install on many servers', 'how many servers'],
    body: `Yes. Most certificates can be installed on **as many servers as you need** (load balancers, several web servers), using the same certificate and private key on each. Copy the key securely between them.`
  },
  {
    slug: 'reminders', title: 'Expiry reminders and notifications', category: 'Lifecycle',
    keywords: ['reminder', 'notification', 'expiry email', 'alert before expiry', 'remind me', 'reminder settings'],
    body: `On each certificate page, **Reminders & auto-renew** lets you choose how many days before expiry you want a reminder. CertDesk also lists everything due in the next 30 days. Ask me "what's due in the next 30 days" any time.`
  },

  // ───────────── Install & troubleshooting
  {
    slug: 'install-aws', title: 'Install on AWS (Certificate Manager / load balancer)', category: 'Install',
    keywords: ['aws', 'acm', 'amazon certificate manager', 'elb', 'alb', 'cloudfront', 'import certificate aws'],
    body: `1. In **AWS Certificate Manager** → **Import certificate**.
2. Certificate body: \`domain.crt\`. Private key: your key. Certificate chain: \`domain.ca-bundle.crt\`.
3. Attach it to your load balancer listener or CloudFront distribution.

For CloudFront, import it in the **us-east-1** region.`
  },
  {
    slug: 'install-azure', title: 'Install on Azure App Service', category: 'Install',
    keywords: ['azure', 'app service', 'azure web app', 'azure ssl binding'],
    body: `1. Make a **PFX** with the [format converter](/tools/converter) (certificate + CA bundle + private key, with a password).
2. In your App Service → **Certificates** → **Bring your own certificate (.pfx)** → upload.
3. **Custom domains** → add the binding → choose the certificate, SNI SSL.`
  },
  {
    slug: 'install-exchange', title: 'Install on Microsoft Exchange', category: 'Install',
    keywords: ['exchange', 'exchange server', 'outlook certificate', 'owa ssl'],
    body: `1. If the CSR was made in Exchange: **Exchange admin center** → Servers → **Certificates** → select the pending request → **Complete** and give the path to \`domain.crt\`.
2. Otherwise import a **PFX** (made with the [format converter](/tools/converter)).
3. **Assign services** (IIS, SMTP, IMAP/POP as needed) to the new certificate.`
  },
  {
    slug: 'install-haproxy', title: 'Install on HAProxy', category: 'Install',
    keywords: ['haproxy', 'combined pem', 'pem with key'],
    body: `HAProxy wants **one PEM file** with the certificate, the chain and the private key:

\`cat domain.fullchain.pem domain.key > /etc/haproxy/certs/domain.pem\`

Then in the frontend: \`bind *:443 ssl crt /etc/haproxy/certs/domain.pem\` and reload HAProxy.`
  },
  {
    slug: 'install-node', title: 'Use the certificate in Node.js, Python or Go apps', category: 'Install',
    keywords: ['node', 'nodejs', 'express https', 'python ssl', 'go tls', 'application server ssl'],
    body: `Point your app at the **full chain** and the **private key**:

- Node.js: \`https.createServer({ cert: fs.readFileSync('domain.fullchain.pem'), key: fs.readFileSync('domain.key') }, app)\`
- Python: \`ssl_context.load_cert_chain('domain.fullchain.pem', 'domain.key')\`
- Go: \`http.ListenAndServeTLS(":443", "domain.fullchain.pem", "domain.key", nil)\`

Many teams terminate TLS at Nginx or a load balancer instead.`
  },
  {
    slug: 'chain-intermediate', title: 'What is the CA bundle / intermediate certificate?', category: 'Install',
    keywords: ['ca bundle', 'intermediate certificate', 'chain', 'chain incomplete', 'missing intermediate', 'root certificate'],
    body: `Browsers trust the CA's **root**, and your certificate is signed by an **intermediate**. Your server must send your certificate **plus the intermediate(s)**: that's the CA bundle.

- Nginx/HAProxy/Node: use \`domain.fullchain.pem\` (already in the right order).
- Apache (older) / cPanel: install \`domain.ca-bundle.crt\` in the chain/CA bundle field.

A missing chain often works on desktop but fails on phones and API clients.`
  },
  {
    slug: 'key-mismatch', title: '"Private key does not match the certificate"', category: 'Troubleshooting',
    keywords: ['key does not match', 'key mismatch', 'private key mismatch', 'certificate and key not matching', 'x509 key values mismatch'],
    body: `The certificate was issued for a **different key** than the one you're installing, usually because a new CSR was made later, or a reissue used another key.

- Use the key that was created together with the CSR of **this** issuance.
- Check: \`openssl x509 -noout -modulus -in domain.crt | openssl md5\` and \`openssl rsa -noout -modulus -in domain.key | openssl md5\`. The two hashes must match.
- Can't find the right key? **Reissue** with a new key and CSR (free).`
  },
  {
    slug: 'verify-install', title: 'How do I check my certificate is installed correctly?', category: 'Install',
    keywords: ['check installation', 'verify ssl', 'test ssl', 'is my ssl installed', 'ssl test', 'check certificate online'],
    body: `Run the [SSL checker](/tools/ssl-checker) on your domain. It shows the certificate being served, its expiry, the names it covers and whether the chain is complete.

Also open the site in a private browser window and click the padlock.`
  },
  {
    slug: 'https-redirect', title: 'Redirect all HTTP traffic to HTTPS', category: 'Install',
    keywords: ['redirect http to https', 'force https', 'https redirect', 'always https'],
    body: `- **Nginx:** \`server { listen 80; server_name example.com www.example.com; return 301 https://$host$request_uri; }\`
- **Apache (.htaccess):** \`RewriteEngine On\`, \`RewriteCond %{HTTPS} off\`, \`RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]\`
- **cPanel:** Domains → turn on **Force HTTPS Redirect**.

If you use HTTP file validation, keep \`/.well-known/pki-validation/\` reachable over plain http during validation.`
  },
  {
    slug: 'mixed-content', title: 'Padlock missing: mixed content', category: 'Troubleshooting',
    keywords: ['mixed content', 'padlock missing', 'not fully secure', 'insecure content', 'http images on https'],
    body: `The page loads over HTTPS but some images, scripts or styles still use \`http://\`. Browsers then hide the padlock or block those files.

- Change those links to \`https://\` (or relative \`//\` paths).
- WordPress: update the site URL to https and use a search-replace for old http links.
- The browser console (F12) lists every insecure file.`
  },
  {
    slug: 'hsts', title: 'What is HSTS and should I enable it?', category: 'Troubleshooting',
    keywords: ['hsts', 'strict transport security', 'preload'],
    body: `**HSTS** tells browsers to always use HTTPS for your site. Turn it on only after HTTPS works everywhere (including all subdomains if you add \`includeSubDomains\`):

\`Strict-Transport-Security: max-age=31536000\`

Start with a short max-age while testing. Don't submit to the preload list unless you're sure, because removing a domain from it takes a long time.`
  },
  {
    slug: 'tls-grade', title: 'Improving my SSL test grade (TLS settings)', category: 'Troubleshooting',
    keywords: ['ssl labs', 'ssl grade', 'tls 1.0', 'tls 1.3', 'weak ciphers', 'improve ssl rating'],
    body: `The grade depends on **server settings**, not the brand of certificate:

- Allow only **TLS 1.2 and 1.3**; disable SSLv3, TLS 1.0 and 1.1.
- Use modern ciphers (for example Mozilla's "intermediate" configuration).
- Serve the full chain, and add HSTS once HTTPS is stable.`
  },
  {
    slug: 'old-cert-still-showing', title: 'The old certificate still shows after installing the new one', category: 'Troubleshooting',
    keywords: ['old certificate still showing', 'new certificate not showing', 'still shows expired', 'installed but not working', 'cache old ssl'],
    body: `- **Restart or reload** the web server (Nginx, Apache, IIS) after replacing files.
- Check the site's config points to the **new** files, and that no other virtual host or load balancer serves the old one.
- CDNs and load balancers (Cloudflare, AWS) have their own certificate: update it there too.
- Test again with the [SSL checker](/tools/ssl-checker) rather than a browser that may cache the old one.`
  },
  {
    slug: 'old-devices', title: 'Works on desktop but fails on phones or old devices', category: 'Troubleshooting',
    keywords: ['works on desktop not mobile', 'android error', 'iphone ssl error', 'old devices', 'java ssl error', 'curl ssl error', 'api client ssl error'],
    body: `Almost always a **missing intermediate chain**: desktop browsers can fetch it themselves, phones and API clients don't.

Install the **full chain** (\`domain.fullchain.pem\`, or add the CA bundle), reload the server and test with the [SSL checker](/tools/ssl-checker).`
  },

  // ───────────── CSR & keys
  {
    slug: 'csr-openssl', title: 'Generate a CSR with OpenSSL', category: 'CSR & keys',
    keywords: ['openssl csr', 'generate csr command', 'create csr linux', 'csr on server', 'openssl req'],
    body: `On Linux or macOS:

\`openssl req -new -newkey rsa:2048 -nodes -keyout example.com.key -out example.com.csr -subj "/CN=example.com"\`

Keep \`example.com.key\` safe on the server and upload/paste \`example.com.csr\` when ordering. Or let CertDesk generate both in your browser on the order page.`
  },
  {
    slug: 'csr-windows', title: 'Generate a CSR on Windows / IIS', category: 'CSR & keys',
    keywords: ['iis csr', 'windows csr', 'create certificate request iis', 'csr on windows server'],
    body: `IIS Manager → your server → **Server Certificates** → **Create Certificate Request**. Fill in the common name (your domain), choose RSA 2048, save the request file and upload it when ordering.

After issuance, use **Complete Certificate Request** on the **same server** with \`domain.crt\`. The key stays inside Windows.`
  },
  {
    slug: 'key-size', title: 'Which key type and size should I use?', category: 'CSR & keys',
    keywords: ['key size', 'rsa 2048', 'rsa 4096', 'ecdsa', 'ecc key', 'key algorithm'],
    body: `- **RSA 2048** works everywhere and is the default.
- **RSA 3072/4096** is stronger but slower; fine for most sites.
- **ECDSA P-256** is faster and smaller, supported by all modern clients.

Avoid RSA 1024: CAs reject it.`
  },
  {
    slug: 'csr-fields', title: 'What to enter in the CSR fields', category: 'CSR & keys',
    keywords: ['csr fields', 'common name', 'organization field', 'csr country code', 'what is cn', 'csr details'],
    body: `- **Common name (CN):** the main domain, e.g. \`www.example.com\` or \`*.example.com\` for a wildcard.
- **Organisation, city, state, country:** only matter for **OV/EV**, where they must match your verified company details. For DV they're ignored.
- **Country:** the two-letter code (IN, US, GB…).`
  },
  {
    slug: 'file-formats', title: '.crt, .cer, .pem, .key: what are these files?', category: 'CSR & keys',
    keywords: ['crt vs pem', 'cer file', 'pem file', 'what is pem', 'file extension', 'key file', 'difference crt pem'],
    body: `- **.crt / .cer / .pem:** a certificate in text (PEM) form, starting \`-----BEGIN CERTIFICATE-----\`. Usually you can just rename between them.
- **.key:** the private key. Keep it secret.
- **.pfx / .p12:** certificate + key (+ chain) in one password-protected file, for Windows and Java.
- **.p7b:** certificates only, no key.

Need a different format? Use the [format converter](/tools/converter).`
  },
  {
    slug: 'find-private-key', title: 'Where is my private key?', category: 'CSR & keys',
    keywords: ['where is private key', 'find private key', 'private key location', 'key on server', 'cpanel private key'],
    body: `It's wherever the CSR was created:

- **Generated in CertDesk:** the \`.key\` file your browser downloaded (check Downloads or the Files app).
- **cPanel:** SSL/TLS → **Private Keys**.
- **Linux/OpenSSL:** the \`-keyout\` file, often in your home folder or \`/etc/ssl/\`.
- **Windows/IIS:** inside the server's certificate store; finish with Complete Certificate Request on that server.

Not found? **Reissue** with a new key (free).`
  },
  {
    slug: 'pfx-password', title: 'I forgot the PFX password', category: 'CSR & keys',
    keywords: ['pfx password', 'forgot pfx password', 'p12 password', 'pfx password wrong'],
    body: `A PFX password can't be recovered. Make a **new PFX** with the [format converter](/tools/converter) from \`domain.crt\`, \`domain.ca-bundle.crt\` and your private key, and set a new password.`
  },
  {
    slug: 'csr-decode-check', title: 'Check what is inside my CSR', category: 'CSR & keys',
    keywords: ['check csr', 'decode csr', 'csr decoder', 'verify csr', 'csr details wrong'],
    body: `Paste it into the [CSR decoder](/tools/csr-decoder). It shows the domain (CN), extra names, organisation fields and key size. CertDesk also checks the CSR automatically when you upload it on the order or reissue page.`
  },

  // ───────────── Automation
  {
    slug: 'acme-what', title: 'What is ACME automation?', category: 'Automation',
    keywords: ['acme', 'what is acme', 'certbot', 'automatic ssl', 'auto install ssl', 'eab', 'automation', 'lets encrypt', 'free ssl like lets encrypt'],
    body: `**ACME** is the standard protocol tools like **certbot**, acme.sh, Caddy and Traefik use to request and renew certificates automatically. With an ACME subscription, your server gets a fresh certificate before each expiry, with no manual reissues.

Your subscription page shows the **ACME server URL** and **EAB credentials** to plug into the tool.`
  },
  {
    slug: 'certbot-setup', title: 'Set up certbot with my ACME subscription', category: 'Automation',
    keywords: ['certbot setup', 'certbot eab', 'certbot command', 'acme.sh', 'configure certbot'],
    body: `Use the values from your subscription page:

\`certbot certonly --server <ACME URL> --eab-kid <EAB KID> --eab-hmac-key <EAB HMAC> -d example.com -d www.example.com\`

Then point Nginx/Apache at the files certbot creates. Its timer renews automatically. Keep the EAB values secret.`
  },
  {
    slug: 'plan-automate', title: 'What is Plan + Automate?', category: 'Automation',
    keywords: ['plan automate', 'auto install', 'agent install', 'automated subscription', 'autoinstall'],
    body: `A subscription where certificates are **issued, renewed and installed automatically** through the CA's agent or ACME. You don't reissue by hand. It's the easiest way to stay ahead of the shorter lifetimes coming in 2027 and 2029.

Ask the support team to move a certificate to automation.`
  },
  {
    slug: 'manual-vs-auto', title: 'Manual certificates or automation: which is better?', category: 'Automation',
    keywords: ['manual or automatic', 'should i automate', 'automation benefits', 'manual vs automated'],
    body: `- **Manual:** fine for a few certificates; you reissue, validate and install every ~6 months (more often from 2027).
- **Automated:** no reissues to remember, no surprise expiries. Best when you have many certificates or can't afford downtime.`
  },

  // ───────────── Account & CertDesk
  {
    slug: 'what-is-certdesk', title: 'What is CertDesk?', category: 'Account',
    keywords: ['what is certdesk', 'who are you', 'who is this', 'what are you', 'about this console', 'who provides certificates', 'who is the ca'],
    body: `CertDesk is your console for ordering and managing SSL/TLS certificates: validation help, reissues, renewals, downloads, reminders and automation, in one place. Certificates are issued by trusted CAs (DigiCert, Sectigo, GeoTrust, RapidSSL, Thawte and others).`
  },
  {
    slug: 'private-key-safety', title: 'Does CertDesk store my private key?', category: 'Account',
    keywords: ['do you store private key', 'do you keep my private key', 'can you see my private key', 'is my key safe', 'privacy', 'security of keys', 'key stored on server'],
    body: `**No.** When you generate a key in CertDesk, it's created **in your browser** and saved only to your device. CertDesk and the CA only ever receive the CSR (which contains the public key). That's why a lost key can't be downloaded again. You reissue instead.`
  },
  {
    slug: 'team-users', title: 'Adding team members to my account', category: 'Account',
    keywords: ['add user', 'add team member', 'invite colleague', 'second login', 'multiple users', 'team access'],
    body: `Accounts are invite-only. Ask the support team to add a colleague (name and email) and they'll receive an invitation to the same account.`
  },
  {
    slug: 'password-account', title: 'Changing my password or account details', category: 'Account',
    keywords: ['change password', 'reset password', 'update email', 'account settings', 'profile', 'forgot password'],
    body: `Open [Account](/account) to change your password and details. Forgot your password? Use "Forgot password" on the sign-in page, or ask support to reset it.`
  },
  {
    slug: 'export-list', title: 'Export my certificate list', category: 'Account',
    keywords: ['export', 'csv', 'excel', 'download list', 'report of certificates', 'inventory export'],
    body: `On a computer, open **My certificates**, tick the certificates you want (or all) and choose **Export CSV**. It includes domains, products, statuses and dates. Or ask me "list my certificates" for a quick view here.`
  },
  {
    slug: 'ct-logs', title: 'Why is my domain visible in public logs?', category: 'Troubleshooting',
    keywords: ['certificate transparency', 'subdomain visible on crt.sh', 'ct log', 'crt.sh', 'domain public', 'subdomain exposed'],
    body: `Every public certificate is recorded in **Certificate Transparency** logs (searchable on sites like crt.sh). This is required by browsers and can't be turned off, so all names in a certificate become public. Use a **wildcard** if you don't want individual subdomain names listed.`
  },
  {
    slug: 'dns-propagation', title: 'How long until my DNS record is visible?', category: 'Validation',
    keywords: ['dns propagation', 'how long dns', 'dns not updated', 'ttl', 'record not visible yet'],
    body: `New records are often visible within minutes, but can take up to the zone's TTL (sometimes an hour). Changing an existing record can take as long as its old TTL.

Ask me "check my DNS" and I'll look it up in public DNS right now.`
  }
];
