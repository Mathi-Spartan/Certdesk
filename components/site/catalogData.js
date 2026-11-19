// Shared by the home page and the certificates page.

export const LEVEL_CARDS = [
  { key: 'dv', glyph: 'D', title: 'Domain Validation', sub: 'Fastest and lowest cost', popular: true,
    rows: [['What is checked', 'Domain only'], ['Issued in', 'Minutes'], ['Company name shown', false], ['Wildcard', true], ['Best for', 'Blogs, tools, most sites']] },
  { key: 'ov', glyph: 'B', title: 'Organisation Validation', sub: 'Your business is verified',
    rows: [['What is checked', 'Domain + company'], ['Issued in', '1–3 days'], ['Company name shown', true], ['Wildcard', true], ['Best for', 'Business sites, portals']] },
  { key: 'ev', glyph: 'E', title: 'Extended Validation', sub: 'Highest assurance', 
    rows: [['What is checked', 'Full legal entity'], ['Issued in', '3–5 days'], ['Company name shown', true], ['Wildcard', false], ['Best for', 'Payments, banking']] }
];

export const NEEDS = [
  { glyph: 'D', key: 'dv', title: 'Domain SSL', text: 'Encrypt a site in minutes', points: ['Issued in minutes', 'www + non-www'] },
  { glyph: 'A', key: 'auto', title: 'Automated SSL', text: 'Renews and installs itself', points: ['Plan + Automate', 'ACME CaaS'], isNew: true },
  { glyph: 'B', key: 'ov', title: 'Business SSL', text: 'Company verified (OV)', points: ['Company in certificate', '1–3 days'] },
  { glyph: 'W', key: 'wildcard', title: 'Wildcard SSL', text: 'All subdomains, one cert', points: ['*.yourdomain.com', 'DV or OV'] },
  { glyph: 'M', key: 'multi', title: 'Multi-domain', text: 'Many sites, one cert', points: ['Up to 250 domains', 'DV, OV or EV'] }
];
