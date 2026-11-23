/**
 * Fuzzy question → article matching without an AI model.
 * Normalises words (synonyms, light stemming, stop words), then scores each article by how well
 * the message overlaps its title and each example phrasing, weighting rare words higher.
 */

const STOP = new Set(('a an the is are was were be been am do does did doing to of for in on at by with from and or but if then so ' +
  'my our your his her their its it this that these those i we you me us they them can could should would will shall may might must ' +
  'whom whose please pls plz kindly hi hello hey thanks thank need want get got have has had ' +
  'there here any some all just about into than also very really ok okay still not no yes up out over again any one').split(' '));

const CANON = [
  [/\bcertificates?\b|\bcerts?\b|\bssl\b|\btls\b/g, 'cert'],
  [/\be-?mail(s|ed)?\b|\bmails?\b/g, 'email'],
  [/\bweb ?site(s)?\b|\bsite(s)?\b/g, 'site'],
  [/\bsub-?domains?\b/g, 'subdomain'],
  [/\bdomain names?\b/g, 'domain'],
  [/\bprivate key\b/g, 'privkey'],
  [/\bkey file\b/g, 'privkey'],
  [/\bca bundle\b|\bintermediates?\b|\bchain\b/g, 'chain'],
  [/\borganization\b|\borganisation\b|\bcompany\b|\bbusiness\b/g, 'org'],
  [/\bverif(y|ication|ied)\b|\bvalidat(e|ion|ed|ing)\b|\bdcv\b/g, 'validate'],
  [/\bre-?issu(e|ed|es|ing)\b/g, 'reissue'],
  [/\brenew(al|als|ed|ing|s)?\b/g, 'renew'],
  [/\bexpir(e|es|ed|y|ies|ing|ation)\b/g, 'expire'],
  [/\binstall(ation|ed|ing|s)?\b|\bset ?up\b|\bconfigure\b/g, 'install'],
  [/\bdownload(s|ed|ing)?\b/g, 'download'],
  [/\bcost(s)?\b|\bpric(e|es|ing)\b|\bcharges?\b|\bfees?\b/g, 'price'],
  [/\bwild ?card\b|\bstar domain\b/g, 'wildcard'],
  [/\bmulti-?domains?\b|\bsans?\b|\bucc\b/g, 'multidomain'],
  [/\bmobile\b|\bandroid\b|\biphone\b|\bphones?\b/g, 'phone'],
  [/\bwindows server\b/g, 'windows']
];

export function tokens(text) {
  let t = ' ' + String(text || '').toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9.*@' ]+/g, ' ') + ' ';
  for (const [re, rep] of CANON) t = t.replace(re, ' ' + rep + ' ');
  return t.split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, '').replace(/'s$/, ''))
    .filter((w) => w && !STOP.has(w) && w.length > 1)
    .map(stem);
}

function stem(w) {
  if (w.length <= 4 || /\d/.test(w) || w.includes('.')) return w;
  return w.replace(/(ies)$/, 'y').replace(/(ing|ed|es|s)$/, '').replace(/(e)$/, '') || w;
}

/** Build an index once per article list. */
export function buildIndex(articles) {
  const docs = articles.map((a) => {
    const phrases = [a.title, ...(a.keywords || [])].map((p) => tokens(p)).filter((p) => p.length);
    const bag = new Set(phrases.flat());
    return { a, phrases, bag };
  });
  const df = new Map();
  for (const d of docs) for (const w of d.bag) df.set(w, (df.get(w) || 0) + 1);
  const N = docs.length || 1;
  const idf = (w) => Math.log(1 + N / (df.get(w) || 0.5));
  return { docs, idf };
}

/**
 * Score every article for a message. Returns [{ a, score }] best first; score is 0..~1.
 * score = best phrase match (how much of the phrase the message covers, weighted by rare words)
 *         blended with how much of the message the article explains.
 */
export function matchArticles(index, text, limit = 5) {
  const q = [...new Set(tokens(text))];
  if (!q.length) return [];
  const qWeight = q.reduce((s, w) => s + index.idf(w), 0);
  const out = [];
  for (const d of index.docs) {
    let best = 0;
    for (const p of d.phrases) {
      const ps = new Set(p);
      let hit = 0;
      let tot = 0;
      for (const w of ps) { const iw = index.idf(w); tot += iw; if (q.includes(w)) hit += iw; }
      if (!tot || !hit) continue;
      // weighted Dice: rewards phrases that match the message closely, not just one shared word
      const dice = (2 * hit) / (tot + qWeight);
      if (dice > best) best = dice;
    }
    let qHit = 0;
    for (const w of q) if (d.bag.has(w)) qHit += index.idf(w);
    const explain = qWeight ? qHit / qWeight : 0;
    const score = best * 0.7 + explain * 0.3;
    if (score > 0.12) out.push({ a: d.a, score: +score.toFixed(3) });
  }
  return out.sort((x, y) => y.score - x.score).slice(0, limit);
}
