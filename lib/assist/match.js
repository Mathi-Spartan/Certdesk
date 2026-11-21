/**
 * Intent matching without an AI model: normalise the text, expand synonyms,
 * score every intent by weighted phrases, and report how sure we are.
 */

const SYNONYMS = [
  [/\bcert(s|ificate|ificates)?\b|\bssl\b|\btls\b/g, ' cert '],
  [/\blist\b|\bwhich (orders|certs?|ones|domains)\b|\bwhat (orders|certs?|domains)\b|\ball (orders|certs?|domains)\b|\bshow (me )?(all|my) \b|\bupcoming\b|\bcoming up\b|\bnext \d+ days\b|\bwithin \d+ days\b|\bthis (week|month)\b|\bnext (week|month)\b/g, (m) => ` listq ${m} `],
  [/\bnot (yet )?(been )?issued\b|\bisn'?t issued\b|\bnot generated\b|\bnot received\b|\bnot getting issued\b|\bstill pending\b|\bstuck\b|\bwaiting\b|\bpending\b|\bnot coming\b|\btaking (so )?long\b|\bdelay(ed)?\b/g, ' notissued '],
  [/\bexpir(e|es|ed|y|ies|ing|ation)\b|\bvalid (till|until)\b|\bvalidity\b|\bend date\b|\bdays left\b|\bhow long\b/g, ' expiry '],
  [/\bauto[- ]?renew(al)?\b|\bautomatic(ally)? renew\b/g, ' autorenew '],
  [/\bre-?issue(d|s)?\b|\bre-?key\b|\bregenerate\b/g, ' reissue '],
  [/\brenew(al|ed|ing|s)?\b|\bextend\b/g, ' renew '],
  [/\bdownload(s|ed|ing)?\b|\bget (my |the )?files?\b|\bzip\b|\bcrt\b|\bca ?bundle\b|\bfull ?chain\b|\bintermediate\b/g, ' download '],
  [/\binstall(ation|ed|ing)?\b|\bsetup\b|\bset up\b|\bconfigure\b|\bdeploy\b|\bput (it )?on\b/g, ' install '],
  [/\bnginx\b/g, ' install server_nginx '],
  [/\bapache\b|\bhttpd\b/g, ' install server_apache '],
  [/\biis\b|\bwindows server\b/g, ' install server_iis '],
  [/\bc ?panel\b|\bwhm\b/g, ' install server_cpanel '],
  [/\bplesk\b/g, ' install server_plesk '],
  [/\btomcat\b|\bjava\b|\bkeystore\b/g, ' install server_tomcat '],
  [/\bpfx\b|\bp12\b|\bpkcs ?#?12\b|\bjks\b|\bpkcs ?#?7\b|\bp7b\b|\bconvert(er|ing)?\b|\bder\b/g, ' convert '],
  [/\bprivate ?key\b|\bkey file\b|\b\.key\b/g, ' privatekey '],
  [/\blost\b|\bmissing\b|\bdeleted\b|\bcan'?t find\b|\bcannot find\b|\bwhere is\b/g, ' lost '],
  [/\bcname\b|\btxt record\b|\bdns\b|\brecord\b|\bnameserver\b/g, ' dns '],
  [/\bhttp file\b|\bvalidation file\b|\bupload\b|\bfile (based )?validation\b|\bpki-?validation\b|\bwell-?known\b|\bupload (the )?file\b/g, ' httpfile '],
  [/\bapprov(al|er|e)\b|\bvalidation email\b|\bemail validation\b|\badmin@\b/g, ' approvalemail '],
  [/\bvalidat(e|ion|ing)\b|\bverif(y|ication)\b|\bdcv\b|\bdomain control\b|\bprove\b/g, ' validate '],
  [/\bcancel(lation|led)?\b|\brefund(ed)?\b|\bmoney back\b/g, ' cancel '],
  [/\badd (more |extra |another )?domains?\b|\bmore domains\b|\bextra domains?\b|\bsan(s)?\b|\bsubdomains?\b|\bmulti ?domain\b/g, ' adddomain '],
  [/\bbuy\b|\bpurchase\b|\bnew order\b|\border (a )?new\b|\bprice\b|\bcost\b|\bhow much\b|\bwhich cert\b/g, ' buy '],
  [/\bhuman\b|\bagent\b|\bperson\b|\bsomeone\b|\bsupport team\b|\bcall me\b|\bphone\b|\bcontact\b|\btalk to\b|\bspeak to\b|\bcustomer care\b/g, ' human '],
  [/\bnot secure\b|\bwarning\b|\berror\b|\bmismatch\b|\buntrusted\b|\binvalid\b|\berr_cert\w*\b|\bnet::\w+\b|\bbroken\b|\bnot working\b|\bred padlock\b|\bchain\b/g, ' browsererror '],
  [/\b(200|100|47|398)[ -]?days?\b|\b2027\b|\b2029\b|\bshorter\b|\blifetime\b|\bca\/?b forum\b/g, ' lifetime '],
  [/\bcsr\b|\bsigning request\b/g, ' csr '],
  [/\bchange\b|\bswitch\b|\bdifferent method\b|\binstead of\b|\buse dns\b|\buse http\b|\buse email\b/g, ' change '],
  [/\bstatus\b|\bwhat'?s happening\b|\bupdate\b|\bprogress\b/g, ' status '],
  [/\bwhat needs\b|\battention\b|\boverview\b|\bsummary\b|\ball (my )?cert\b|\banything to do\b|\bto ?do\b/g, ' overview '],
  [/\bcaa\b/g, ' caa '],
  [/\bthank(s| you)?\b|\bthx\b|\bgreat\b|\bperfect\b|\bawesome\b|\bsolved\b|\bworks now\b/g, ' thanks '],
  [/^ ?(hi|hello|hey|hii+|good (morning|afternoon|evening)|vanakkam|namaste)\b/g, ' greet '],
  [/\bhelp\b|\bmenu\b|\bwhat can you do\b|\boptions\b/g, ' helpme ']
];

export function normalise(text) {
  let t = ' ' + String(text || '').toLowerCase().replace(/[’`]/g, "'").replace(/[^\w@.\-:\/#' ]+/g, ' ') + ' ';
  for (const [re, rep] of SYNONYMS) t = t.replace(re, rep);
  return t.replace(/\s+/g, ' ').trim();
}

const DOMAIN = /\b((?:\*\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24})\b/gi;
export function extractDomains(text) {
  const out = [];
  for (const m of String(text || '').matchAll(DOMAIN)) {
    const d = m[1].toLowerCase();
    if (/\.(key|crt|pem|pfx|p12|cer|csr|zip|jks|txt|html?)$/.test(d)) continue;
    if (/^(e\.g|i\.e)\./.test(d)) continue;
    out.push(d);
  }
  return [...new Set(out)];
}
export function extractOrderNumbers(text) {
  return [...String(text || '').matchAll(/#?\b(\d{6,9})\b/g)].map((m) => Number(m[1]));
}

/** Each intent: tokens that count (weight), and tokens it needs at least one of. */
export const INTENTS = {
  greet: { score: { greet: 3 } },
  thanks: { score: { thanks: 3 } },
  helpme: { score: { helpme: 2 } },
  human: { score: { human: 4 } },
  why_pending: { score: { notissued: 4, status: 1.5, validate: 1 } },
  validate_how: { score: { validate: 2.5, dns: 1.5, httpfile: 2, approvalemail: 2 }, need: ['validate', 'dns', 'httpfile', 'approvalemail'] },
  change_method: { score: { change: 2.5, validate: 1.5, dns: 1, httpfile: 1, approvalemail: 1 }, need: ['change'] },
  dns_check: { score: { dns: 2.5, validate: 1 }, need: ['dns'] },
  expiry: { score: { expiry: 4 } },
  reissue: { score: { reissue: 4, lost: 0.5, privatekey: 0.5 } },
  renew: { score: { renew: 4 } },
  download: { score: { download: 4 } },
  install: { score: { install: 3, server_nginx: 3, server_apache: 3, server_iis: 3, server_cpanel: 3, server_plesk: 3, server_tomcat: 3 } },
  convert: { score: { convert: 4 } },
  privatekey: { score: { privatekey: 4, lost: 2 }, need: ['privatekey'] },
  autorenew: { score: { autorenew: 5 } },
  cancel: { score: { cancel: 4 } },
  adddomain: { score: { adddomain: 4 } },
  buy: { score: { buy: 3 } },
  browsererror: { score: { browsererror: 3.5 } },
  lifetime: { score: { lifetime: 4 } },
  csr: { score: { csr: 3.5 } },
  overview: { score: { overview: 3.5 } },
  list_due: { score: { listq: 2.5, expiry: 2, reissue: 1.5, renew: 1.5, autorenew: 0.5 }, need: ['listq'] },
  status: { score: { status: 3 } },
  caa: { score: { caa: 4 } }
};

/** Best intents for a message: [{ intent, score }], highest first. */
export function rank(text) {
  const tokens = normalise(text).split(' ');
  const set = new Set(tokens);
  const out = [];
  for (const [name, def] of Object.entries(INTENTS)) {
    if (def.need && !def.need.some((t) => set.has(t))) continue;
    let s = 0;
    for (const [tok, w] of Object.entries(def.score)) if (set.has(tok)) s += w;
    if (s > 0) out.push({ intent: name, score: s });
  }
  // Specific beats generic when both fire.
  const has = (n) => out.some((o) => o.intent === n);
  for (const o of out) {
    if (o.intent === 'status' && (has('why_pending') || has('expiry'))) o.score -= 2;
    if (o.intent === 'install' && has('convert')) o.score -= 1;
    if (o.intent === 'dns_check' && has('why_pending')) o.score -= 0.5;
    if (o.intent === 'helpme' && out.length > 1) o.score -= 1.5;
    if (o.intent === 'greet' && out.length > 1) o.score -= 2.5;
    if (o.intent === 'thanks' && out.length > 1) o.score -= 2;
    if (o.intent === 'reissue' && has('privatekey')) o.score -= 1;
    if (has('list_due') && ['expiry', 'reissue', 'renew', 'overview', 'status'].includes(o.intent)) o.score -= 3;
    if (o.intent === 'change_method' && !(has('validate_how') || has('dns_check'))) o.score -= 2;
    if ((o.intent === 'validate_how' || o.intent === 'dns_check') && has('change_method')) o.score -= 1;
  }
  return out.filter((o) => o.score > 0).sort((a, b) => b.score - a.score);
}

export function serverOf(text) {
  const n = normalise(text);
  const m = /server_(nginx|apache|iis|cpanel|plesk|tomcat)/.exec(n);
  return m ? m[1] : null;
}

/** "next 30 days", "within 2 weeks", "this month" → number of days (default 30). */
export function daysWindow(text) {
  const t = String(text || '').toLowerCase();
  let m = /(\d{1,3})\s*(day|days)\b/.exec(t);
  if (m) return Math.min(400, Number(m[1]));
  m = /(\d{1,2})\s*(week|weeks)\b/.exec(t);
  if (m) return Number(m[1]) * 7;
  m = /(\d{1,2})\s*(month|months)\b/.exec(t);
  if (m) return Number(m[1]) * 30;
  if (/this week|next week/.test(t)) return 7;
  if (/this month|next month/.test(t)) return 30;
  return 30;
}
