(() => {
  'use strict';

  const PREF_KEY = 'dash4muni.prefs';
  const THEMES = ['auto', 'light', 'dark'];

  const state = {
    base: 'comuni/esempio/',   // cartella del comune attivo (vedi pickComune)
    comune: 'esempio',
    settings: {},
    engines: [],
    sections: [],
    strings: {},
    prefs: {},
    status: new Map(),   // id elemento -> { cls, msg }
    lastProbe: new Map(), // id elemento -> istante dell'ultimo controllo dal browser
    checks: [],          // { id, url }
    cols: 0,
    timer: null,
    holidays: [],
    clocks: [],
    feeds: [],
    alerts: [],
    textCache: new Map(),   // file di testo degli avvisi -> { time, text }
    feedCache: new Map(),   // url -> { time, data }
  };

  const $ = (sel) => document.querySelector(sel);

  /* ---------- Preferenze (localStorage) ---------- */
  function loadPrefs() {
    try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch (e) { return {}; }
  }
  function savePref(key, value) {
    state.prefs[key] = value;
    try { localStorage.setItem(PREF_KEY, JSON.stringify(state.prefs)); } catch (e) { /* storage non disponibile */ }
  }

  /* ---------- Utilità ---------- */
  async function getJSON(path) {
    const r = await fetch(path, { cache: 'no-cache' });
    if (!r.ok) throw new Error(`${path} (${r.status})`);
    return r.json();
  }

  // Percorsi relativi nei file di configurazione: relativi alla cartella del comune.
  function res(p) {
    return /^(https?:)?\/\//i.test(p) || p.startsWith('/') || p.startsWith('data:') ? p : state.base + p;
  }

  // Apertura dei link: "_blank" (nuova scheda) o "_self" (stessa scheda).
  // Priorità: elemento > blocco > settings.linkTarget > "_blank".
  function setTarget(a, ...overrides) {
    const ok = (v) => v === '_blank' || v === '_self';
    const target = [...overrides, state.settings.linkTarget].find(ok) || '_blank';
    if (target === '_blank') { a.target = '_blank'; a.rel = 'noopener'; }
    else { a.removeAttribute('target'); a.removeAttribute('rel'); }
  }

  // Comune attivo: ?comune=nome nell'URL (se consentito), altrimenti "default" di comune.json, altrimenti "esempio".
  async function pickComune() {
    const ok = (n) => typeof n === 'string' && /^[a-z0-9_-]+$/i.test(n);
    let cfg = {};
    try { cfg = await getJSON('comune.json'); } catch (e) { /* facoltativo */ }
    // "allowQuery": false in comune.json ignora ?comune= e blocca il comune di default.
    let name = cfg.allowQuery === false ? null : new URLSearchParams(location.search).get('comune');
    if (!ok(name)) name = cfg.default;
    if (!ok(name)) name = 'esempio';
    state.comune = name;
    state.base = `comuni/${name}/`;
  }

  function lang() { return state.prefs.lang || state.settings.defaultLanguage || 'it'; }

  // Un testo può essere una stringa o un oggetto { it: "...", en: "..." }.
  function txt(v) {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    return v[lang()] || v[state.settings.defaultLanguage] || v.en || Object.values(v)[0] || '';
  }
  function t(key, vars) {
    let s = state.strings[key] ?? key;
    for (const k in vars || {}) s = s.replace(`{${k}}`, vars[k]);
    return s;
  }

  function safeUrl(u) {
    try {
      const x = new URL(u, location.href);
      return /^https?:$/.test(x.protocol) ? x.href : null;
    } catch (e) { return null; }
  }

  function showNotice(msg) {
    const n = $('#notice');
    n.textContent = msg;
    n.hidden = false;
  }

  /* ---------- Traduzione interfaccia ---------- */
  function applyStrings() {
    document.documentElement.lang = lang();
    document.querySelectorAll('[data-i18n]').forEach((e) => { e.textContent = t(e.dataset.i18n); });
    document.querySelectorAll('[data-i18n-title]').forEach((e) => { e.title = t(e.dataset.i18nTitle); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((e) => { e.placeholder = t(e.dataset.i18nPlaceholder); });
    renderThemeBtn();
  }

  async function loadStrings() {
    try { state.strings = await getJSON(`assets/i18n/${lang()}.json`); } catch (e) { state.strings = {}; }
  }

  /* ---------- Tema ---------- */
  function theme() { return state.prefs.theme || state.settings.defaultTheme || 'auto'; }
  function applyTheme() {
    const th = theme();
    if (th === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = th;
    renderThemeBtn();
  }
  function renderThemeBtn() {
    const th = theme();
    const b = $('#themeBtn');
    b.textContent = { auto: '◐', light: '☀', dark: '☾' }[th];
    b.title = t(`theme.${th}`);
    b.setAttribute('aria-label', b.title);
  }

  /* ---------- Ricerca ---------- */
  function renderEngines() {
    const sel = $('#engineSel');
    sel.textContent = '';
    state.engines.forEach((e) => sel.append(new Option(e.name, e.id)));
    const wanted = state.prefs.engine || state.settings.defaultEngine;
    sel.value = state.engines.some((e) => e.id === wanted) ? wanted : (state.engines[0] || {}).id;
  }

  function onSearch(ev) {
    ev.preventDefault();
    const q = $('#q').value.trim();
    const eng = state.engines.find((e) => e.id === $('#engineSel').value);
    if (!q || !eng) return;
    const url = safeUrl(eng.url.replace('{q}', encodeURIComponent(q)));
    if (!url) return;
    if (state.settings.searchInNewTab) window.open(url, '_blank', 'noopener');
    else location.href = url;
  }

  /* ---------- Rendering sezioni ---------- */
  // Numero di colonne in base alla larghezza reale dell'area dei contenuti:
  // quante ne stanno con almeno "minColumnWidth" px ciascuna, fino a "maxColumns".
  function layoutCfg() {
    const l = state.settings.layout || {};
    const num = (v, d, lo, hi) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.min(hi, Math.max(lo, Number(v))) : d);
    return {
      maxColumns: Math.round(num(l.maxColumns, 3, 1, 6)),
      minColumnWidth: num(l.minColumnWidth, 300, 180, 800),
      maxWidth: num(l.maxWidth, 1600, 640, 4000),
    };
  }

  function colCount() {
    const { maxColumns, minColumnWidth } = layoutCfg();
    const gap = 16;
    const w = $('#sections').clientWidth || document.documentElement.clientWidth;
    return Math.max(1, Math.min(maxColumns, Math.floor((w + gap) / (minColumnWidth + gap))));
  }

  function makeIcon(item, href) {
    const box = document.createElement('span');
    box.className = 'icon';
    const letter = () => {
      box.className = 'icon letter';
      box.textContent = (txt(item.title).trim()[0] || '?').toUpperCase();
    };
    const icon = item.icon;
    if (icon && /^(https?:\/\/|\/|\.\/|[\w-]+\/).*\.(png|svg|jpe?g|gif|ico|webp)$/i.test(icon)) {
      const img = new Image();
      img.alt = ''; img.loading = 'lazy'; img.src = res(icon);
      img.onerror = letter;
      box.append(img);
    } else if (icon) {
      box.textContent = icon;               // emoji o carattere
    } else if (item.favicon !== false && href && new URL(href).origin !== location.origin) {
      const img = new Image();
      img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
      img.src = new URL(href).origin + '/favicon.ico';
      img.onerror = letter;
      box.append(img);
    } else {
      letter();
    }
    return box;
  }

  function renderItem(item, id, block) {
    const href = safeUrl(item.url);
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'item';
    if (href) { a.href = href; setTarget(a, item.target, block && block.target); }
    a.append(makeIcon(item, href));

    const box = document.createElement('span');
    box.className = 'txt';
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = txt(item.title);
    box.append(title);
    const d = txt(item.description);
    if (d) {
      const desc = document.createElement('span');
      desc.className = 'desc';
      desc.textContent = d;
      box.append(desc);
    }
    a.append(box);

    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.dataset.id = id;
    const rawCheck = typeof item.check === 'string' ? item.check : item.url;   // stessa chiave usata da monitor.php
    const checkUrl = item.check === false ? null : safeUrl(rawCheck);
    if (!checkUrl) dot.classList.add('none');
    else state.checks.push({ id, url: checkUrl, key: rawCheck });
    a.append(dot);

    li.append(a);
    return li;
  }

  /* ---------- Blocco orologio digitale ---------- */
  function tzOf(block) {
    if (!block.timezone) return undefined;
    try { new Intl.DateTimeFormat('it', { timeZone: block.timezone }); return block.timezone; }
    catch (e) { return undefined; }
  }

  const CLOCK_STYLES = ['led', 'amber', 'lcd', 'minimal', 'flip', 'accent'];

  function renderClock(el, block) {
    const st = CLOCK_STYLES.includes(block.style) ? block.style : 'accent';
    el.classList.add('clock-' + st);
    const box = document.createElement('div');
    box.className = 'clock';
    const time = document.createElement('div');
    time.className = 'clock-time';
    time.setAttribute('role', 'timer');
    const date = document.createElement('div');
    date.className = 'clock-date';
    box.append(time, date);
    el.append(box);
    state.clocks.push({ time, date, block, st });
  }

  function tick() {
    const now = new Date();
    state.clocks.forEach(({ time, date, block, st }) => {
      const tz = tzOf(block);
      // secondi: se non indicati, nascosti solo nello stile "accent"
      const secs = typeof block.seconds === 'boolean' ? block.seconds : st !== 'accent';
      const tf = new Intl.DateTimeFormat(lang(), {
        hour: '2-digit', minute: '2-digit', second: secs ? '2-digit' : undefined,
        hour12: !!block.hour12, timeZone: tz,
      });
      const parts = tf.formatToParts(now);
      time.textContent = '';
      let plain = '';
      let secBox = null;
      parts.forEach((p, i) => {
        plain += p.value;
        const isColon = p.type === 'literal' && p.value.includes(':');
        const nextIsSec = parts[i + 1] && parts[i + 1].type === 'second';
        const mk = (cls, text) => {
          const s = document.createElement('span');
          if (cls) s.className = cls;
          s.textContent = text;
          return s;
        };
        let nodes;
        if (st === 'flip' && ['hour', 'minute', 'second'].includes(p.type)) {
          nodes = [...p.value].map((ch) => mk('flip-digit', ch));
        } else {
          nodes = [mk(isColon ? 'colon' : '', isColon ? ':' : p.value)];
        }
        if (st === 'minimal' && (p.type === 'second' || (isColon && nextIsSec))) {
          if (!secBox) { secBox = mk('sec', ''); time.append(secBox); }
          nodes.forEach((n) => secBox.append(n));
        } else {
          nodes.forEach((n) => time.append(n));
        }
      });
      time.dataset.ghost = plain.replace(/\d/g, '8');   // usato dallo stile lcd
      date.textContent = new Intl.DateTimeFormat(lang(), st === 'accent'
        ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: tz }
        : { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz }).format(now);
    });
  }

  /* ---------- Blocco calendario festività ---------- */
  function easterSunday(y) {            // algoritmo di Meeus/Jones/Butcher
    const a = y % 19, b = Math.floor(y / 100), c = y % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  }

  function holidaysOf(y) {
    return state.holidays.map((h) => {
      let d;
      if (typeof h.easter === 'number') { d = easterSunday(y); d.setDate(d.getDate() + h.easter); }
      else {
        const [m, dd] = String(h.date).split('-').map(Number);
        d = new Date(y, m - 1, dd);
      }
      return { date: d, name: txt(h.name) };
    }).filter((h) => !isNaN(h.date)).sort((a, b) => a.date - b.date);
  }

  const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  function renderHolidays(el, block) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const view = { y: today.getFullYear(), m: today.getMonth() };

    const wrap = document.createElement('div');
    wrap.className = 'cal';
    const head = document.createElement('div');
    head.className = 'cal-head';
    const prev = document.createElement('button');
    const next = document.createElement('button');
    const label = document.createElement('button');
    prev.type = next.type = label.type = 'button';
    prev.textContent = '‹'; next.textContent = '›';
    prev.title = prev.ariaLabel = t('cal.prev');
    next.title = next.ariaLabel = t('cal.next');
    label.title = t('cal.today');
    label.className = 'cal-label';
    head.append(prev, label, next);
    const grid = document.createElement('div');
    grid.className = 'cal-grid';
    const list = document.createElement('ul');
    list.className = 'hol-list';
    wrap.append(head, grid);
    // block.calendar: "open" (default) | "closed" | "none"
    const mode = ['open', 'closed', 'none'].includes(block.calendar) ? block.calendar : 'open';
    wrap.hidden = mode === 'closed';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'cal-toggle';
    const setToggle = () => {
      toggle.textContent = (wrap.hidden ? '▾ ' : '▴ ') + t(wrap.hidden ? 'cal.show' : 'cal.hide');
      toggle.setAttribute('aria-expanded', String(!wrap.hidden));
    };
    toggle.onclick = () => { wrap.hidden = !wrap.hidden; setToggle(); };
    setToggle();
    if (mode === 'none') el.append(list);
    else el.append(wrap, list, toggle);

    function drawMonth() {
      const marks = new Map();
      holidaysOf(view.y).forEach((h) => marks.set(dayKey(h.date), h.name));
      label.textContent = new Intl.DateTimeFormat(lang(), { month: 'long', year: 'numeric' })
        .format(new Date(view.y, view.m, 1));
      grid.textContent = '';
      const wd = new Intl.DateTimeFormat(lang(), { weekday: 'narrow' });
      for (let i = 0; i < 7; i++) {
        const c = document.createElement('span');
        c.className = 'dow';
        c.textContent = wd.format(new Date(2024, 0, 1 + i));   // 1 gen 2024 = lunedì
        grid.append(c);
      }
      const offset = (new Date(view.y, view.m, 1).getDay() + 6) % 7;
      const days = new Date(view.y, view.m + 1, 0).getDate();
      for (let i = 0; i < offset; i++) grid.append(document.createElement('span'));
      for (let d = 1; d <= days; d++) {
        const date = new Date(view.y, view.m, d);
        const c = document.createElement('span');
        c.className = 'day';
        c.textContent = d;
        if (date.getDay() === 0) c.classList.add('sun');
        if (+date === +today) c.classList.add('today');
        const name = marks.get(dayKey(date));
        if (name) { c.classList.add('hol'); c.title = name; }
        grid.append(c);
      }
    }

    function drawList() {
      list.textContent = '';
      const y = today.getFullYear();
      const up = [...holidaysOf(y), ...holidaysOf(y + 1)].filter((h) => h.date >= today)
        .slice(0, Number(block.count) || 5);
      const df = new Intl.DateTimeFormat(lang(), { weekday: 'short', day: 'numeric', month: 'short' });
      up.forEach((h) => {
        const n = Math.round((h.date - today) / 864e5);
        const li = document.createElement('li');
        const when = document.createElement('span');
        when.className = 'hol-date';
        when.textContent = df.format(h.date);
        const nm = document.createElement('span');
        nm.className = 'hol-name';
        nm.textContent = h.name;
        const rel = document.createElement('span');
        rel.className = 'hol-rel';
        rel.textContent = n === 0 ? t('hol.today') : n === 1 ? t('hol.tomorrow') : t('hol.in', { n });
        if (n <= 1) li.classList.add('soon');
        li.append(when, nm, rel);
        list.append(li);
      });
    }

    prev.onclick = () => { view.m--; if (view.m < 0) { view.m = 11; view.y--; } drawMonth(); };
    next.onclick = () => { view.m++; if (view.m > 11) { view.m = 0; view.y++; } drawMonth(); };
    label.onclick = () => { view.y = today.getFullYear(); view.m = today.getMonth(); drawMonth(); };
    drawMonth();
    drawList();
  }

  /* ---------- Blocco feed RSS / Atom ---------- */
  function parseFeed(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('XML');
    const first = (el, name) => {
      const n = el.getElementsByTagName(name)[0];
      return n ? n.textContent.trim() : '';
    };
    const nodes = Array.from(doc.getElementsByTagName('item'));
    const atom = !nodes.length;
    const entries = atom ? Array.from(doc.getElementsByTagName('entry')) : nodes;
    if (!entries.length) throw new Error('EMPTY');

    const items = entries.map((e) => {
      let link = '';
      if (atom) {
        const l = Array.from(e.getElementsByTagName('link'));
        const alt = l.find((x) => (x.getAttribute('rel') || 'alternate') === 'alternate') || l[0];
        link = alt ? alt.getAttribute('href') || '' : '';
      } else {
        link = first(e, 'link') || first(e, 'guid');
      }
      const dateStr = first(e, atom ? 'updated' : 'pubDate') || first(e, 'published') || first(e, 'date');
      const raw = first(e, atom ? 'summary' : 'description') || first(e, 'content');
      const desc = raw ? (new DOMParser().parseFromString(raw, 'text/html').body.textContent || '').trim() : '';
      const d = dateStr ? new Date(dateStr) : null;
      return { title: first(e, 'title'), link: safeUrl(link), date: d && !isNaN(d) ? d : null, desc };
    });
    const head = doc.querySelector(atom ? 'feed > title' : 'channel > title');
    return { title: head ? head.textContent.trim() : '', items };
  }

  async function fetchFeed(url) {
    const ms = (state.settings.timeoutSeconds || 8) * 1500;
    const attempt = async (u) => {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), ms);
      try {
        const r = await fetch(u, { signal: ctl.signal, cache: 'no-store', credentials: 'omit' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return parseFeed(await r.text());
      } finally { clearTimeout(to); }
    };
    const tries = [];
    if (state.settings.feedProxy) tries.push(state.settings.feedProxy.replace('{url}', encodeURIComponent(url)));
    tries.push(url);                      // lettura diretta (stessa origine o feed con CORS)
    let lastErr;
    for (const u of tries) {
      try { return await attempt(u); } catch (e) { lastErr = e; }
    }
    throw lastErr;
  }

  function paintFeed(f, data) {
    const df = new Intl.DateTimeFormat(lang(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    if (f.heading && !txt(f.block.title) && data.title) f.heading.textContent = data.title;
    f.ul.textContent = '';
    const items = data.items.slice(0, Number(f.block.count) || 6);
    if (!items.length) { f.ul.append(feedMsg(t('rss.empty'))); return; }
    items.forEach((it) => {
      const li = document.createElement('li');
      const a = document.createElement(it.link ? 'a' : 'div');
      a.className = 'item feed-item';
      if (it.link) { a.href = it.link; setTarget(a, f.block.target); }
      const box = document.createElement('span');
      box.className = 'txt';
      const ti = document.createElement('span');
      ti.className = 'title wrap';
      ti.textContent = it.title || it.link || '—';
      box.append(ti);
      if (it.date) {
        const dt = document.createElement('span');
        dt.className = 'desc';
        dt.textContent = df.format(it.date);
        box.append(dt);
      }
      if (f.block.showDescription && it.desc) {
        const ds = document.createElement('span');
        ds.className = 'desc wrap';
        ds.textContent = it.desc.length > 180 ? it.desc.slice(0, 177) + '…' : it.desc;
        box.append(ds);
      }
      a.append(box);
      li.append(a);
      f.ul.append(li);
    });
  }

  function feedMsg(text) {
    const li = document.createElement('li');
    li.className = 'feed-msg';
    li.textContent = text;
    return li;
  }

  async function loadFeed(f, force) {
    const url = res(f.block.url);   // relativo = file nella cartella del comune
    const ttl = (Number(f.block.refreshMinutes) || 15) * 60000;
    const cached = state.feedCache.get(url);
    if (cached && !force && Date.now() - cached.time < ttl) { paintFeed(f, cached.data); return; }
    if (cached) paintFeed(f, cached.data);
    else { f.ul.textContent = ''; f.ul.append(feedMsg(t('rss.loading'))); }
    try {
      const data = await fetchFeed(url);
      state.feedCache.set(url, { time: Date.now(), data });
      paintFeed(f, data);
    } catch (e) {
      if (!cached) { f.ul.textContent = ''; f.ul.append(feedMsg(t('rss.error'))); }
    }
  }

  function renderFeed(el, block, heading) {
    const ul = document.createElement('ul');
    ul.className = 'feed';
    el.append(ul);
    const f = { block, ul, heading };
    state.feeds.push(f);
    if (!safeUrl(block.url)) { ul.append(feedMsg(t('rss.error'))); return; }
    loadFeed(f, false);
  }

  /* ---------- Blocco avviso (sfondo rosso, titolo e descrizione) ---------- */
  const ALERT_ICON = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>';

  function setAlert(a, title, desc) {
    a.title.textContent = title;
    a.desc.textContent = desc;
    a.desc.hidden = !desc;
    a.el.hidden = !(title || desc);
  }

  // File di testo: la prima riga è il titolo, il resto è la descrizione. File vuoto = nessun avviso.
  async function loadAlert(a, force) {
    const b = a.block;
    const file = txt(b.file);
    if (!file) { setAlert(a, txt(b.title), txt(b.description)); return; }
    const apply = (text) => {
      const lines = text.replace(/\r/g, '').trim().split('\n');
      setAlert(a, (lines.shift() || '').trim(), lines.join('\n').trim());
    };
    const ttl = (Number(b.refreshSeconds) || 120) * 1000;
    const cached = state.textCache.get(file);
    if (cached && !force && Date.now() - cached.time < ttl) { apply(cached.text); return; }
    try {
      const r = await fetch(res(file), { cache: 'no-store' });
      if (!r.ok) throw new Error(r.status);
      const text = await r.text();
      state.textCache.set(file, { time: Date.now(), text });
      apply(text);
    } catch (e) {
      if (cached) apply(cached.text);
      else setAlert(a, txt(b.title), txt(b.description));   // file mancante: eventuale testo scritto nel JSON
    }
  }

  function renderAlert(block) {
    const el = document.createElement('article');
    el.className = 'block block-alert';
    el.setAttribute('role', 'alert');
    el.hidden = true;                                       // visibile solo quando c'è del testo
    const icon = document.createElement('div');
    icon.className = 'alert-icon';
    icon.innerHTML = ALERT_ICON;                            // costante, nessun dato esterno
    const body = document.createElement('div');
    body.className = 'alert-body';
    const title = document.createElement('div');
    title.className = 'alert-title';
    const desc = document.createElement('div');
    desc.className = 'alert-desc';
    body.append(title, desc);
    el.append(icon, body);
    const a = { el, title, desc, block };
    state.alerts.push(a);
    loadAlert(a, false);
    return el;
  }

  function renderBlock(block, id) {
    if (block.type === 'alert') return renderAlert(block);
    const el = document.createElement('article');
    el.className = 'block';
    const title = txt(block.title);
    let h = null;
    if (title || block.type === 'rss') {
      h = document.createElement('h3');
      h.textContent = title;
      el.append(h);
    }
    if (block.type === 'rss') { renderFeed(el, block, h); return el; }
    if (block.type === 'clock') { el.classList.add('block-clock'); renderClock(el, block); return el; }
    if (block.type === 'holidays') { el.classList.add('block-cal'); renderHolidays(el, block); return el; }
    const ul = document.createElement('ul');
    (block.items || []).forEach((it, i) => ul.append(renderItem(it, `${id}-${i}`, block)));
    el.append(ul);
    return el;
  }

  function render() {
    const root = $('#sections');
    root.textContent = '';
    state.checks = [];
    state.clocks = [];
    state.feeds = [];
    state.alerts = [];
    state.cols = colCount();

    if (!state.sections.length) { showNotice(t('error.empty')); return; }

    state.sections.forEach((sec, si) => {
      const s = document.createElement('section');
      s.className = 'section';
      const h = document.createElement('h2');
      h.textContent = txt(sec.title);
      s.append(h);

      const grid = document.createElement('div');
      grid.className = 'cols';
      grid.style.setProperty('--cols', state.cols);
      const cols = Array.from({ length: state.cols }, () => {
        const c = document.createElement('div');
        c.className = 'col';
        grid.append(c);
        return c;
      });
      const load = cols.map(() => 0);
      const wide = [];

      (sec.blocks || []).forEach((block, bi) => {
        const el = renderBlock(block, `${si}-${bi}`);
        // Gli avvisi occupano tutta la larghezza (sopra le colonne), salvo "fullWidth": false.
        // Qualsiasi altro blocco può averla con "fullWidth": true.
        const isWide = typeof block.fullWidth === 'boolean' ? block.fullWidth : block.type === 'alert';
        if (isWide) { el.classList.add('wide'); wide.push(el); return; }
        // colonna esplicita (1..3) oppure la più scarica
        let idx = Number.isInteger(block.column) ? Math.min(Math.max(block.column, 1), state.cols) - 1 : load.indexOf(Math.min(...load));
        cols[idx].append(el);
        load[idx] += 2 + (block.items || []).length;
      });

      grid.prepend(...wide);
      s.append(grid);
      root.append(s);
    });

    // riapplica gli ultimi stati noti
    state.status.forEach((_, id) => paintDot(id));
    tick();
  }

  /* ---------- Controllo stato ---------- */
  function paintDot(id) {
    const st = state.status.get(id);
    document.querySelectorAll(`.dot[data-id="${id}"]`).forEach((d) => {
      if (d.classList.contains('none')) return;
      d.classList.remove('ok', 'ko');
      if (st) { d.classList.add(st.cls); d.title = st.msg; d.setAttribute('aria-label', st.msg); }
      else { d.title = t('status.checking'); }
    });
  }

  async function probe(url) {
    const ms = (state.settings.timeoutSeconds || 8) * 1000;
    const run = async (mode) => {
      const ctl = new AbortController();
      const to = setTimeout(() => ctl.abort(), ms);
      try {
        return await fetch(url, { mode, cache: 'no-store', credentials: 'omit', redirect: 'follow', signal: ctl.signal });
      } finally { clearTimeout(to); }
    };
    // 1) richiesta normale: se l'origine è la stessa (o ha CORS) si legge il vero codice HTTP.
    try {
      const r = await run('cors');
      return r.status === 200
        ? { cls: 'ok', msg: t('status.ok') }
        : { cls: 'ko', msg: t('status.http', { code: r.status }) };
    } catch (e) {
      if (e.name === 'AbortError') return { cls: 'ko', msg: t('status.timeout') };
    }
    // 2) CORS non consentito: no-cors dice solo se l'host risponde.
    try {
      await run('no-cors');
      return { cls: 'ok', msg: t('status.reachable') };
    } catch (e) {
      return { cls: 'ko', msg: e.name === 'AbortError' ? t('status.timeout') : t('status.down') };
    }
  }

  // Stato calcolato dal server (monitor.php): vero codice HTTP, un solo controllo per tutti i visitatori.
  async function loadServerStatus() {
    const m = state.settings.monitor;
    if (!m || m.enabled === false) return null;
    try {
      const r = await fetch(`monitor.php?comune=${encodeURIComponent(state.comune)}`, { cache: 'no-store' });
      if (!r.ok) return null;
      const j = await r.json();
      return j && j.enabled ? j : null;
    } catch (e) { return null; }
  }

  function applyServer(id, s, checked) {
    const hhmm = checked ? new Intl.DateTimeFormat(lang(), { hour: '2-digit', minute: '2-digit' }).format(new Date(checked * 1000)) : '';
    let msg;
    if (s.up) msg = t('status.up_code', { code: s.code });
    else if (s.code) msg = t('status.http', { code: s.code });
    else msg = t('status.down_srv', { error: s.error || t('status.down') });
    if (hhmm) msg += ' · ' + t('status.checked', { time: hhmm });
    state.status.set(id, { cls: s.up ? 'ok' : 'ko', msg });
    paintDot(id);
  }

  // Controlli dal browser: solo per elementi che il server non copre (o se non c'è PHP),
  // e non più spesso di monitor.intervalSeconds (default refreshSeconds), per non pesare sui siti.
  async function runChecks(force) {
    const served = await loadServerStatus();
    const minGap = ((state.settings.monitor && state.settings.monitor.intervalSeconds) || state.settings.refreshSeconds || 60) * 1000;
    const queue = [];
    state.checks.forEach((c) => {
      const s = served && served.items && served.items[c.key];
      if (s) { applyServer(c.id, s, served.checked); return; }
      if (!force && Date.now() - (state.lastProbe.get(c.id) || 0) < minGap && state.status.has(c.id)) return;
      queue.push(c);
    });
    const worker = async () => {
      while (queue.length) {
        const c = queue.shift();
        state.lastProbe.set(c.id, Date.now());
        const res = await probe(c.url);
        state.status.set(c.id, res);
        paintDot(c.id);
      }
    };
    await Promise.all(Array.from({ length: 3 }, worker));
  }

  function schedule() {
    clearInterval(state.timer);
    const s = Number(state.settings.refreshSeconds) || 0;
    if (s > 0) {
      state.timer = setInterval(() => { if (!document.hidden) runChecks(); }, s * 1000);
    }
  }

  /* ---------- Avvio ---------- */
  async function loadSections() {
    state.sections = [];
    let index;
    try { index = await getJSON(res('sections.json')); }
    catch (e) { showNotice(t('error.load', { file: res('sections.json') })); return; }
    const files = index.sections || [];
    const results = await Promise.allSettled(files.map((f) => getJSON(res(f))));
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') state.sections.push(r.value);
      else showNotice(t('error.load', { file: res(files[i]) }));
    });
  }

  function renderLangs() {
    const sel = $('#langSel');
    sel.textContent = '';
    const langs = state.settings.languages || { it: 'Italiano' };
    Object.entries(langs).forEach(([k, v]) => sel.append(new Option(v, k)));
    sel.value = lang();
  }

  function applyLayout() {
    document.documentElement.style.setProperty('--maxw', layoutCfg().maxWidth + 'px');
  }

  function setTitle() {
    const title = txt(state.settings.title) || 'Dash4Muni';
    $('#siteTitle').textContent = title;
    document.title = title;

    const sub = txt(state.settings.subtitle);
    const subEl = $('#siteSubtitle');
    subEl.textContent = sub;
    subEl.hidden = !sub;

    // Logo (max 120x120 via CSS); se manca o non si carica resta nascosto.
    const link = $('#logoLink');
    const img = $('#logo');
    const src = state.settings.logo;
    if (!src) { link.hidden = true; return; }
    img.alt = txt(state.settings.logoAlt) || '';
    img.onload = () => { link.hidden = false; };
    img.onerror = () => { link.hidden = true; };
    img.src = res(src);
    const href = state.settings.logoLink && safeUrl(state.settings.logoLink);
    if (href) { link.href = href; setTarget(link); }
    else { link.removeAttribute('href'); link.removeAttribute('target'); link.removeAttribute('rel'); }
  }

  // Barra in fondo: settings.footer = { text, link, linkLabel }
  function setFooter() {
    const f = state.settings.footer;
    const el = $('#footer');
    el.textContent = '';
    if (!f) { el.hidden = true; return; }
    const text = txt(f.text);
    const href = f.link && safeUrl(f.link);
    if (text) el.append(document.createTextNode(text));
    if (href) {
      if (text) el.append(document.createTextNode(/:\s*$/.test(text) ? ' ' : ' · '));
      const a = document.createElement('a');
      a.href = href; setTarget(a);
      a.textContent = txt(f.linkLabel) || href.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
      el.append(a);
    }
    el.hidden = !el.childNodes.length;
  }

  async function init() {
    state.prefs = loadPrefs();
    await pickComune();
    try { state.settings = await getJSON(res('settings.json')); }
    catch (e) { state.settings = {}; showNotice(t('error.load', { file: res('settings.json') })); }

    await loadStrings();
    applyTheme();
    setTitle();
    setFooter();
    applyLayout();
    renderLangs();
    applyStrings();

    try { state.engines = (await getJSON(res('engines.json'))).engines || []; }
    catch (e) { showNotice(t('error.load', { file: res('engines.json') })); }
    renderEngines();

    try { state.holidays = (await getJSON(res('holidays.json'))).holidays || []; }
    catch (e) { state.holidays = []; }

    await loadSections();
    render();
    runChecks();
    schedule();
    setInterval(tick, 1000);
    // ricarica i feed scaduti (ogni "refreshMinutes", default 15)
    // e rilegge i file di testo degli avvisi (ogni "refreshSeconds" del blocco, default 120)
    setInterval(() => {
      if (document.hidden) return;
      state.feeds.forEach((f) => loadFeed(f, false));
      state.alerts.forEach((a) => loadAlert(a, false));
    }, 30000);

    // Eventi
    $('#searchForm').addEventListener('submit', onSearch);
    $('#engineSel').addEventListener('change', (e) => savePref('engine', e.target.value));
    $('#refreshBtn').addEventListener('click', () => runChecks(true));
    $('#themeBtn').addEventListener('click', () => {
      savePref('theme', THEMES[(THEMES.indexOf(theme()) + 1) % THEMES.length]);
      applyTheme();
    });
    $('#langSel').addEventListener('change', async (e) => {
      savePref('lang', e.target.value);
      await loadStrings();
      applyStrings();
      setTitle();
      setFooter();
      render();
      runChecks();
    });
    // Ricalcola le colonne quando cambia la larghezza dell'area contenuti (finestra, pannello, rotazione).
    let raf = 0;
    new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { if (colCount() !== state.cols) render(); });
    }).observe($('#sections'));
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName)) {
        e.preventDefault();
        $('#q').focus();
      }
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) runChecks(); });
  }

  init();
})();
