// Generates animated stats / languages / activity cards from the GitHub API.
// Usage: GITHUB_TOKEN=... node stats.mjs <username> <outDir>     (or MOCK=file.json for local testing)
import fs from 'node:fs';

const [user = 'Taherhotel', outDir = 'dist'] = process.argv.slice(2);
const NEON = '#00ff9c', BG = '#0d1117', CARD = '#161b22', BORDER = '#30363d', TXT = '#c9d1d9', DIM = '#8b949e';
const FONT = `'Fira Code','JetBrains Mono',Consolas,'Courier New',monospace`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n));

const query = `query($login:String!){ user(login:$login){
  name
  followers{totalCount}
  pullRequests{totalCount}
  issues{totalCount}
  repositories(ownerAffiliations:OWNER, isFork:false, first:100, orderBy:{field:UPDATED_AT,direction:DESC}){
    totalCount
    nodes{ stargazerCount forkCount
      languages(first:10, orderBy:{field:SIZE,direction:DESC}){ edges{ size node{ name color } } } } }
  contributionsCollection{
    totalCommitContributions restrictedContributionsCount
    totalPullRequestContributions totalIssueContributions totalRepositoriesWithContributedCommits
    contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount } } } } } }`;

async function load() {
  if (process.env.MOCK) return JSON.parse(fs.readFileSync(process.env.MOCK, 'utf8'));
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `bearer ${process.env.GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: user } }),
  });
  const j = await r.json();
  if (j.errors || !j.data?.user) throw new Error(JSON.stringify(j.errors || j));
  return j.data.user;
}

const shell = (w, h, title, inner, extraCss = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<style>
@keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.f{opacity:0;animation:fade .6s ease-out forwards}
.blink{animation:b 1s steps(1) infinite}@keyframes b{50%{opacity:0}}
${extraCss}
</style>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="12" fill="${BG}" stroke="${BORDER}"/>
<circle cx="20" cy="20" r="5" fill="#ff5f56"/><circle cx="37" cy="20" r="5" fill="#ffbd2e"/><circle cx="54" cy="20" r="5" fill="#27c93f"/>
<text x="76" y="24" font-size="13" fill="${NEON}" font-family="${FONT}">${esc(title)}<tspan class="blink"> █</tspan></text>
${inner}
</svg>`;

/* ---------- stats card ---------- */
function statsCard(u) {
  const c = u.contributionsCollection;
  const stars = u.repositories.nodes.reduce((a, r) => a + r.stargazerCount, 0);
  const rows = [
    ['★', 'Total stars', stars],
    ['⎇', 'Commits (last year)', c.totalCommitContributions + c.restrictedContributionsCount],
    ['⇄', 'Pull requests', u.pullRequests.totalCount],
    ['!', 'Issues opened', u.issues.totalCount],
    ['▣', 'Public repos', u.repositories.totalCount],
    ['◆', 'Contributed to', c.totalRepositoriesWithContributedCommits],
  ];
  const total = c.contributionCalendar.totalContributions;
  let inner = '';
  rows.forEach(([ic, label, val], i) => {
    const y = 64 + i * 27;
    inner += `<g class="f" style="animation-delay:${0.15 + i * 0.12}s">
      <text x="24" y="${y}" font-size="14" fill="${NEON}" font-family="${FONT}">${ic}</text>
      <text x="46" y="${y}" font-size="13.5" fill="${TXT}" font-family="${FONT}">${label}</text>
      <text x="270" y="${y}" font-size="13.5" font-weight="700" fill="#fff" text-anchor="end" font-family="${FONT}">${fmt(val)}</text></g>`;
  });
  // animated ring with yearly contributions
  const R = 46, C = 2 * Math.PI * R;
  inner += `<g transform="translate(375,118)">
    <circle r="${R}" fill="none" stroke="${CARD}" stroke-width="9"/>
    <circle r="${R}" fill="none" stroke="${NEON}" stroke-width="9" stroke-linecap="round" transform="rotate(-90)"
      stroke-dasharray="${C}" stroke-dashoffset="${C}" class="ring"/>
    <text y="4" text-anchor="middle" font-size="22" font-weight="700" fill="#fff" font-family="${FONT}" class="f" style="animation-delay:.9s">${fmt(total)}</text>
    <text y="24" text-anchor="middle" font-size="10" fill="${DIM}" font-family="${FONT}" class="f" style="animation-delay:1s">contribs/yr</text>
  </g>`;
  const css = `.ring{animation:ring 1.6s cubic-bezier(.3,.9,.3,1) .3s forwards}@keyframes ring{to{stroke-dashoffset:${C * 0.18}}}`;
  return shell(460, 230, `${user} --stats`, inner, css);
}

/* ---------- languages card ---------- */
function langsCard(u) {
  const tot = {};
  for (const r of u.repositories.nodes)
    for (const e of r.languages.edges) {
      const k = e.node.name;
      tot[k] = tot[k] || { size: 0, color: e.node.color || NEON };
      tot[k].size += e.size;
    }
  const list = Object.entries(tot).sort((a, b) => b[1].size - a[1].size).slice(0, 6);
  const sum = list.reduce((a, [, v]) => a + v.size, 0) || 1;
  let inner = '', css = '';
  // stacked bar
  let x = 24;
  const BW = 412;
  inner += `<clipPath id="bar"><rect x="24" y="46" width="${BW}" height="10" rx="5"/></clipPath><g clip-path="url(#bar)">`;
  list.forEach(([, v], i) => {
    const w = (v.size / sum) * BW;
    inner += `<rect x="${x}" y="46" width="${w + 0.5}" height="10" fill="${v.color}" class="seg" style="animation-delay:${0.2 + i * 0.12}s"/>`;
    x += w;
  });
  inner += `</g>`;
  list.forEach(([name, v], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const px = 24 + col * 210, py = 86 + row * 46;
    const pct = ((v.size / sum) * 100).toFixed(1);
    const bw = 170 * (v.size / list[0][1].size);
    inner += `<g class="f" style="animation-delay:${0.4 + i * 0.1}s">
      <circle cx="${px + 5}" cy="${py - 4}" r="5" fill="${v.color}"/>
      <text x="${px + 16}" y="${py}" font-size="13" fill="${TXT}" font-family="${FONT}">${esc(name)}</text>
      <text x="${px + 190}" y="${py}" font-size="12" fill="${DIM}" text-anchor="end" font-family="${FONT}">${pct}%</text></g>
      <rect x="${px}" y="${py + 9}" width="190" height="4" rx="2" fill="${CARD}"/>
      <rect x="${px}" y="${py + 9}" width="${bw}" height="4" rx="2" fill="${v.color}" class="grow" style="animation-delay:${0.5 + i * 0.1}s"/>`;
  });
  css = `.seg{transform:scaleX(0);transform-box:fill-box;transform-origin:left;animation:g .5s ease-out forwards}
  .grow{transform:scaleX(0);transform-box:fill-box;transform-origin:left;animation:g .9s cubic-bezier(.3,.9,.3,1) forwards}
  @keyframes g{to{transform:scaleX(1)}}`;
  return shell(460, 230, `${user} --top-langs`, inner, css);
}

/* ---------- activity graph (last 60 days) ---------- */
function activityCard(u) {
  const days = u.contributionsCollection.contributionCalendar.weeks.flatMap((w) => w.contributionDays).slice(-60);
  const W = 940, H = 280, L = 50, R = 20, T = 56, B = 46;
  const max = Math.max(4, ...days.map((d) => d.contributionCount));
  const sx = (i) => L + (i / (days.length - 1)) * (W - L - R);
  const sy = (v) => T + (1 - v / max) * (H - T - B);
  // smooth path
  const pts = days.map((d, i) => [sx(i), sy(d.contributionCount)]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2;
    d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`;
  }
  const area = `${d} L${pts.at(-1)[0]},${H - B} L${pts[0][0]},${H - B} Z`;
  let grid = '';
  for (let k = 0; k <= 4; k++) {
    const v = Math.round((max * k) / 4), y = sy(v);
    grid += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="${CARD}"/>
      <text x="${L - 10}" y="${y + 4}" font-size="11" fill="${DIM}" text-anchor="end" font-family="${FONT}">${v}</text>`;
  }
  let labels = '';
  for (let i = 0; i < days.length; i += 10) {
    const dt = new Date(days[i].date + 'T00:00:00Z');
    labels += `<text x="${sx(i)}" y="${H - B + 20}" font-size="11" fill="${DIM}" text-anchor="middle" font-family="${FONT}">${dt.toLocaleString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</text>`;
  }
  let dots = '';
  pts.forEach(([x, y], i) => {
    if (days[i].contributionCount > 0)
      dots += `<circle cx="${x}" cy="${y}" r="3.2" fill="${BG}" stroke="${NEON}" stroke-width="2" class="f" style="animation-delay:${0.3 + (i / pts.length) * 2}s"/>`;
  });
  const sum = days.reduce((a, x) => a + x.contributionCount, 0);
  const inner = `<defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${NEON}" stop-opacity=".35"/><stop offset="1" stop-color="${NEON}" stop-opacity="0"/></linearGradient>
    <filter id="gl"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <text x="${W - 24}" y="24" font-size="12" fill="${DIM}" text-anchor="end" font-family="${FONT}">${sum} contributions · last 60 days</text>
    ${grid}${labels}
    <path d="${area}" fill="url(#ar)" class="area"/>
    <path d="${d}" fill="none" stroke="${NEON}" stroke-width="2.5" filter="url(#gl)" pathLength="1" class="line"/>
    ${dots}
    <rect x="${L}" y="${T - 6}" width="3" height="${H - T - B + 6}" fill="${NEON}" opacity=".5" class="scan"/>`;
  const css = `.line{stroke-dasharray:1;stroke-dashoffset:1;animation:draw 2.4s ease-in-out .2s forwards}@keyframes draw{to{stroke-dashoffset:0}}
  .area{opacity:0;animation:fade 1s ease-out 1.8s forwards}
  .scan{animation:scan 5s linear 2.6s infinite;opacity:0}@keyframes scan{0%{opacity:.5;transform:translateX(0)}100%{opacity:.5;transform:translateX(${W - L - R}px)}}`;
  return shell(W, H, `${user} --activity`, inner, css);
}

const u = await load();
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(`${outDir}/stats.svg`, statsCard(u));
fs.writeFileSync(`${outDir}/langs.svg`, langsCard(u));
fs.writeFileSync(`${outDir}/activity.svg`, activityCard(u));
console.log('cards written to', outDir);
