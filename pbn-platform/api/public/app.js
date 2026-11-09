/**
 * Aplicația client (fără build): catalog, comandă din poza proprie (iCloud/dispozitiv
 * sau Google Photos), urmărirea procesării, previzualizare, aprobare.
 * Vorbește doar cu API-ul /v1; tot textul venit de la server e inserat ca text, nu HTML.
 */
import { secureUpload } from '/web/secure-upload.js';

const COLOR_COUNTS = [12, 18, 24, 30, 36, 48, 60];
const SIZES = [
  { w: 300, h: 400, label: '30 × 40 cm' },
  { w: 400, h: 500, label: '40 × 50 cm' },
  { w: 500, h: 650, label: '50 × 65 cm' },
];
const ORDER_STATUS = {
  draft: 'Ciornă',
  awaiting_processing: 'Se generează',
  awaiting_approval: 'Așteaptă aprobarea ta',
  awaiting_payment: 'Aprobată — urmează plata',
  paid: 'Plătită',
  in_production: 'În producție',
  shipped: 'Expediată',
  cancelled: 'Anulată',
};
const DIFFICULTY = { 'ușor': 'Ușor', mediu: 'Mediu', avansat: 'Avansat', expert: 'Expert' };

const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');
let pollTimer = null;

// ---------------------------------------------------------------------------
// Utilitare DOM (fără innerHTML pentru date venite de la server)
// ---------------------------------------------------------------------------
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

function toast(message, bad = false) {
  const t = $('#toast');
  t.textContent = message;
  t.className = `show${bad ? ' bad' : ''}`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.className = ''; }, 4200);
}

const lid = (n, hex) => {
  const el = h('span', { class: 'lid', 'aria-hidden': 'true' }, String(n));
  if (hex) {
    el.style.setProperty('--c', hex);
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    if (0.299 * r + 0.587 * g + 0.114 * b < 140) el.classList.add('dark');
  }
  return el;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Sesiune & API
// ---------------------------------------------------------------------------
const session = {
  get() { try { return JSON.parse(localStorage.getItem('pbn.session')) ?? null; } catch { return null; } },
  set(s) { try { localStorage.setItem('pbn.session', JSON.stringify(s)); } catch { /* mod privat */ } },
  clear() { try { localStorage.removeItem('pbn.session'); } catch { /* ignore */ } },
};

class ApiError extends Error {
  constructor(status, body) {
    super(body?.message ?? `Eroare ${status}`);
    this.status = status;
    this.code = body?.error;
  }
}

async function api(path, { method = 'GET', body } = {}) {
  const s = session.get();
  const res = await fetch(path, {
    method,
    headers: {
      ...(s?.token ? { Authorization: `Bearer ${s.token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.status === 401 && s) {
    session.clear();
    renderAccount();
    toast('Sesiunea a expirat. Intră din nou în cont.', true);
  }
  if (!res.ok) throw new ApiError(res.status, json);
  return json;
}

function requireLogin() {
  if (session.get()) return Promise.resolve(true);
  return openLogin();
}

function openLogin() {
  const dlg = $('#login');
  $('#login-error').textContent = '';
  return new Promise((resolve) => {
    const form = $('#login-form');
    const done = (ok) => { form.onsubmit = null; $('#login-cancel').onclick = null; dlg.close(); resolve(ok); };
    $('#login-cancel').onclick = () => done(false);
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const data = new FormData(form);
      try {
        const res = await api('/v1/dev/session', { method: 'POST', body: { email: data.get('email'), plan: data.get('plan') } });
        session.set({ token: res.token, ...res.user });
        renderAccount();
        toast(`Ai intrat în cont ca ${res.user.email}.`);
        done(true);
      } catch (err) {
        $('#login-error').textContent = err.status === 404
          ? 'Autentificarea de test e dezactivată în producție. Configurează furnizorul de identitate.'
          : err.message;
      }
    };
    dlg.showModal();
  });
}

function renderAccount() {
  const box = $('#account');
  box.replaceChildren();
  const s = session.get();
  if (!s) {
    box.append(h('button', { onclick: () => openLogin().then((ok) => ok && route()) }, 'Intră în cont'));
    return;
  }
  box.append(
    h('span', {}, s.email, s.plan === 'premium' ? ' · Premium' : ''),
    h('button', { class: 'ghost', onclick: () => { session.clear(); renderAccount(); location.hash = '#/'; } }, 'Ieși'),
  );
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------
async function renderCatalog() {
  view.replaceChildren(h('p', { class: 'progress' }, h('span', { class: 'spinner' }), 'Se încarcă catalogul…'));
  let items = [];
  try {
    items = (await api('/v1/catalog?limit=60')).items;
  } catch (err) {
    view.replaceChildren(h('p', { class: 'error' }, `Catalogul nu s-a încărcat: ${err.message}`));
    return;
  }
  const lead = items.find((i) => i.images?.numbered && i.images?.painted);
  const figure = (src, caption) => h('figure', {},
    src ? h('img', { src, alt: caption, loading: 'eager' }) : h('div', { class: 'placeholder-canvas' }, caption),
    h('figcaption', {}, caption));

  const hero = h('section', { class: 'hero' },
    h('div', {},
      h('h1', {}, 'Fotografia ta, pictată de mâna ta.'),
      h('p', {}, 'Alegi o poză, noi o transformăm într-o pânză cu contururi numerotate și îți trimitem exact vopselele de care ai nevoie, dozate pe fiecare culoare.'),
      h('div', { class: 'row' },
        h('a', { class: 'button primary', href: '#/create' }, 'Creează din poza ta'),
        h('a', { class: 'button', href: '#catalog' }, 'Vezi modelele gata făcute'))),
    h('div', { class: 'diptych' },
      figure(lead?.images.numbered, 'Pânza pe care o primești'),
      figure(lead?.images.painted, 'Tabloul terminat')));

  // Variantele aceleiași fotografii (24/36/48 culori…) devin un singur card cu selector.
  const groups = [...items.reduce((m, d) => {
    const key = d.source_image_id ?? d.id;
    m.set(key, [...(m.get(key) ?? []), d]);
    return m;
  }, new Map()).values()].map((g) => g.sort((a, b) => a.num_colors - b.num_colors));
  const grid = items.length
    ? h('div', { class: 'catalog' }, groups.map(designCard))
    : h('div', { class: 'empty' },
      h('h3', {}, 'Catalogul e încă gol'),
      h('p', {}, 'Modelele apar aici după primul import. Până atunci, poți crea un tablou din propria fotografie.'),
      h('a', { class: 'button primary', href: '#/create' }, 'Creează din poza ta'));

  view.replaceChildren(hero, h('h2', { id: 'catalog' }, 'Modele din catalog'), grid);
}

function designCard(variants) {
  let d = variants[0];
  const img = d.images?.mockup
    ? h('img', { src: d.images.mockup, alt: `Mockup: ${d.title}`, loading: 'lazy' })
    : h('div', { class: 'placeholder-canvas' }, 'Fără imagine');
  const facts = h('ul', { class: 'facts' });
  const paintFacts = () => facts.replaceChildren(
    h('li', {}, `${d.canvas_w_mm / 10} × ${d.canvas_h_mm / 10} cm`),
    d.difficulty && h('li', {}, DIFFICULTY[d.difficulty] ?? d.difficulty),
    d.num_regions && h('li', {}, `${d.num_regions} zone de pictat`),
    d.total_paint_ml && h('li', {}, `${Number(d.total_paint_ml).toLocaleString('ro-RO')} ml vopsea`));
  paintFacts();
  const picker = variants.length > 1
    ? h('label', { class: 'variant' }, 'Număr de culori',
      h('select', {
        onchange: (e) => {
          d = variants[Number(e.target.value)];
          if (d.images?.mockup && img.tagName === 'IMG') img.src = d.images.mockup;
          paintFacts();
        },
      }, variants.map((v, i) => h('option', { value: i }, `${v.num_colors} culori`))))
    : h('p', { class: 'muted' }, `${d.num_colors} culori`);
  return h('article', { class: 'design' },
    img, h('h3', {}, d.title), picker, facts,
    d.author_name && h('p', { class: 'credit' }, 'Foto: ',
      d.attribution_url ? h('a', { href: d.attribution_url, target: '_blank', rel: 'noopener' }, d.author_name) : d.author_name),
    h('div', {}, h('button', {
      class: 'primary',
      onclick: async (ev) => {
        if (!(await requireLogin())) return;
        ev.target.disabled = true;
        try {
          const o = await api('/v1/orders', { method: 'POST', body: { catalogDesignId: d.id } });
          location.hash = `#/order/${o.orderId}`;
        } catch (err) {
          toast(err.message, true);
          ev.target.disabled = false;
        }
      },
    }, 'Comandă acest model')));
}

// ---------------------------------------------------------------------------
// Creare din poza proprie
// ---------------------------------------------------------------------------
const draft = { source: null, numColors: 24, size: 1, fit: 'crop' };

async function renderCreate() {
  const s = session.get();
  const premium = s?.plan === 'premium';
  const step = (n, title, state, ...body) => h('section', { class: `step ${state}` }, lid(n), h('div', {}, h('h2', {}, title), ...body));

  const step1Body = [];
  if (!s) {
    step1Body.push(h('p', {}, 'Intră în cont ca să îți alegi fotografia.'),
      h('button', { class: 'primary', onclick: () => openLogin().then((ok) => ok && route()) }, 'Intră în cont'));
  } else if (!premium) {
    step1Body.push(h('p', {}, 'Tablourile din fotografiile tale fac parte din planul Premium. Pe planul gratuit poți comanda modele din catalog.'),
      h('a', { class: 'button', href: '#/' }, 'Vezi catalogul'));
  } else if (draft.source) {
    step1Body.push(h('div', { class: 'chosen' },
      draft.source.preview ? h('img', { src: draft.source.preview, alt: 'Fotografia aleasă' }) : null,
      h('div', {}, h('strong', {}, 'Fotografia e pregătită'), h('p', { class: 'muted' }, draft.source.label)),
      h('button', { class: 'ghost', onclick: () => { draft.source = null; renderCreate(); } }, 'Schimbă fotografia')));
  } else {
    step1Body.push(h('div', { class: 'sources' }, deviceSource(), await googleSource()));
  }

  const ready = Boolean(draft.source);
  const colorChoices = h('fieldset', {}, h('legend', {}, 'Număr de culori'),
    h('div', { class: 'colors' }, COLOR_COUNTS.map((n) => h('label', {},
      h('input', { type: 'radio', name: 'colors', value: n, checked: draft.numColors === n, disabled: !ready,
        onchange: () => { draft.numColors = n; } }),
      h('span', {}, String(n))))));
  const sizeSel = h('select', { disabled: !ready, onchange: (e) => { draft.size = Number(e.target.value); } },
    SIZES.map((sz, i) => h('option', { value: i, selected: draft.size === i }, sz.label)));
  const fitSel = h('select', { disabled: !ready, onchange: (e) => { draft.fit = e.target.value; } },
    h('option', { value: 'crop', selected: draft.fit === 'crop' }, 'Decupează ca să umple pânza'),
    h('option', { value: 'pad', selected: draft.fit === 'pad' }, 'Păstrează toată poza (margini albe)'));
  const submit = h('button', { class: 'primary', disabled: !ready, onclick: createOrder }, 'Generează previzualizarea');

  view.replaceChildren(h('h1', {}, 'Tablou din fotografia ta'), h('div', { class: 'steps' },
    step(1, 'Alege fotografia', ready ? 'done' : 'current', ...step1Body),
    step(2, 'Alege culorile și mărimea', ready ? 'current' : 'locked',
      h('p', { class: 'muted' }, 'Mai multe culori înseamnă mai multe detalii și zone mai mici de pictat. 24 de culori e un început bun.'),
      colorChoices,
      h('div', { class: 'grid2' }, h('label', {}, 'Mărimea pânzei', sizeSel), h('label', {}, 'Încadrare', fitSel)),
      submit),
    step(3, 'Verifică și aprobă', 'locked',
      h('p', { class: 'muted' }, 'Vezi pânza numerotată, tabloul final și lista de vopsele înainte să plătești.'))));
}

function deviceSource() {
  const status = h('p', { class: 'muted' }, 'Pe iPhone și iPad, galeria include pozele din iCloud. Fotografia e criptată în browser înainte de trimitere.');
  const input = h('input', {
    type: 'file', accept: 'image/jpeg,image/png,image/heic,image/heif,image/webp', 'aria-label': 'Alege o fotografie',
    onchange: async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 50 * 1024 * 1024) { toast('Fotografia depășește 50 MB. Alege una mai mică.', true); return; }
      input.disabled = true;
      try {
        const { uploadId } = await secureUpload(file, {
          apiBase: '/v1', token: session.get().token,
          onProgress: (stage) => {
            status.replaceChildren(h('span', { class: 'progress' }, h('span', { class: 'spinner' }), {
              requesting: 'Se pregătește încărcarea…', encrypting: 'Se criptează fotografia…',
              uploading: 'Se trimite…', finalizing: 'Se verifică…', done: 'Se verifică…',
            }[stage] ?? '…'));
          },
        });
        const up = await waitFor(() => api(`/v1/uploads/${uploadId}`), (u) => ['ingested', 'failed'].includes(u.status), 90);
        if (up.status !== 'ingested') throw new Error(`Fotografia nu a putut fi folosită: ${up.error ?? 'eroare necunoscută'}`);
        draft.source = { id: up.sourceImageId, preview: URL.createObjectURL(file), label: file.name };
        renderCreate();
      } catch (err) {
        input.disabled = false;
        status.textContent = err.message;
        toast(err.message, true);
      }
    },
  });
  return h('div', { class: 'source' },
    h('h3', {}, 'Din telefon sau iCloud'), status,
    h('div', { class: 'dropzone' }, h('span', { class: 'button primary' }, 'Alege o fotografie'), input));
}

async function googleSource() {
  const box = h('div', { class: 'source' }, h('h3', {}, 'Din Google Photos'));
  let connected = false;
  try { connected = (await api('/v1/integrations/google')).connected; } catch { /* afișăm butonul de conectare */ }
  if (!connected) {
    box.append(h('p', {}, 'Conectează contul o singură dată. Vedem doar pozele pe care le alegi tu.'),
      h('button', {
        class: 'primary',
        onclick: async () => {
          try {
            const { authUrl } = await api('/v1/integrations/google/connect?returnTo=' + encodeURIComponent('/#/create'));
            location.href = authUrl;
          } catch (err) { toast(err.message, true); }
        },
      }, 'Conectează Google Photos'));
    return box;
  }
  const status = h('p', { class: 'muted' }, 'Se deschide Google Photos într-o fereastră nouă; alege poza și închide fereastra.');
  const btn = h('button', {
    class: 'primary',
    onclick: async () => {
      btn.disabled = true;
      const popup = window.open('about:blank', '_blank');
      try {
        const { sessionId, pickerUri } = await api('/v1/integrations/google/picker-sessions', { method: 'POST', body: { maxItems: 1 } });
        if (popup) popup.location = pickerUri; else window.open(pickerUri, '_blank');
        status.replaceChildren(h('span', { class: 'progress' }, h('span', { class: 'spinner' }), 'Aștept să alegi poza în Google Photos…'));
        const s = await waitFor(() => api(`/v1/integrations/google/picker-sessions/${sessionId}`),
          (x) => ['ingested', 'failed', 'expired'].includes(x.status), 30 * 60);
        if (s.status !== 'ingested' || !s.sourceImageIds.length) throw new Error(s.status === 'expired' ? 'Sesiunea Google a expirat. Încearcă din nou.' : 'Nu am primit nicio poză din Google Photos.');
        draft.source = { id: s.sourceImageIds[0], preview: null, label: 'Fotografie din Google Photos' };
        renderCreate();
      } catch (err) {
        popup?.close();
        btn.disabled = false;
        status.textContent = err.code === 'google_reconnect_required' ? 'Accesul la Google Photos a fost revocat. Conectează contul din nou.' : err.message;
      }
    },
  }, 'Alege din Google Photos');
  box.append(status, btn);
  return box;
}

async function createOrder(ev) {
  ev.target.disabled = true;
  const sz = SIZES[draft.size];
  try {
    const o = await api('/v1/orders', { method: 'POST', body: {
      sourceImageId: draft.source.id, numColors: draft.numColors, canvasWmm: sz.w, canvasHmm: sz.h, fit: draft.fit,
    } });
    draft.source = null;
    location.hash = `#/order/${o.orderId}`;
  } catch (err) {
    toast(err.message, true);
    ev.target.disabled = false;
  }
}

/** Repetă `fn` la 1.5 s până când `done(result)` sau expiră `maxSeconds`. */
async function waitFor(fn, done, maxSeconds) {
  const until = Date.now() + maxSeconds * 1000;
  for (;;) {
    const r = await fn();
    if (done(r)) return r;
    if (Date.now() > until) throw new Error('Operația durează neobișnuit de mult. Reîncarcă pagina mai târziu.');
    await sleep(1500);
  }
}

// ---------------------------------------------------------------------------
// Comenzi
// ---------------------------------------------------------------------------
async function renderOrders() {
  if (!(await requireLogin())) { location.hash = '#/'; return; }
  const { items } = await api('/v1/orders');
  if (!items.length) {
    view.replaceChildren(h('h1', {}, 'Comenzile mele'), h('div', { class: 'empty' },
      h('p', {}, 'Nu ai încă nicio comandă.'), h('a', { class: 'button primary', href: '#/create' }, 'Creează din poza ta')));
    return;
  }
  view.replaceChildren(h('h1', {}, 'Comenzile mele'), h('div', { class: 'table-wrap' }, h('table', { class: 'orders' },
    h('thead', {}, h('tr', {}, ['Comanda', 'Model', 'Pânză', 'Stare', ''].map((t) => h('th', { scope: 'col' }, t)))),
    h('tbody', {}, items.map((o) => h('tr', {},
      h('td', {}, new Date(o.created_at).toLocaleDateString('ro-RO')),
      h('td', {}, o.catalog_title ?? 'Din poza ta', ` · ${o.num_colors} culori`),
      h('td', {}, `${o.canvas_w_mm / 10} × ${o.canvas_h_mm / 10} cm`),
      h('td', {}, h('span', { class: `status ${o.status}` }, ORDER_STATUS[o.status] ?? o.status)),
      h('td', {}, h('a', { href: `#/order/${o.id}` }, 'Deschide'))))))));
}

async function renderOrder(id) {
  if (!(await requireLogin())) { location.hash = '#/'; return; }
  let order = await api(`/v1/orders/${id}`);
  const jobId = order.approved_job_id ?? order.jobs?.at(-1)?.jobId;
  const statusLine = h('p', {});
  const paintStatus = () => statusLine.replaceChildren(
    h('span', { class: `status ${order.status}` }, ORDER_STATUS[order.status] ?? order.status),
    ` · ${order.num_colors} culori · ${order.canvas_w_mm / 10} × ${order.canvas_h_mm / 10} cm`);
  paintStatus();
  const header = h('div', {},
    h('p', {}, h('a', { href: '#/orders' }, 'Comenzile mele')),
    h('h1', {}, `Comanda din ${new Date(order.created_at).toLocaleDateString('ro-RO')}`),
    statusLine);
  const body = h('div', {});
  view.replaceChildren(header, body);
  if (!jobId) { body.append(h('p', { class: 'error' }, 'Comanda nu are încă o previzualizare.')); return; }

  const show = async () => {
    const job = await api(`/v1/jobs/${jobId}`);
    if (['queued', 'running'].includes(job.status) || (job.status === 'failed' && job.attempts < 3)) {
      body.replaceChildren(h('p', { class: 'progress' }, h('span', { class: 'spinner' }),
        job.status === 'running' ? 'Pictorul nostru digital lucrează: se calculează culorile și contururile…' : 'Comanda e în coadă și pornește imediat…'));
      pollTimer = setTimeout(show, 2000);
      return;
    }
    if (job.status !== 'succeeded') {
      body.replaceChildren(h('p', { class: 'error' }, 'Previzualizarea nu a putut fi generată din această fotografie. Încearcă o altă poză sau scrie-ne și o verificăm manual.'));
      return;
    }
    // Starea comenzii s-a schimbat cât timp job-ul rula (ex. „așteaptă aprobarea"): o recitim.
    order = await api(`/v1/orders/${id}`);
    paintStatus();
    body.replaceChildren(renderPreview(job, order, jobId));
  };
  await show();
}

function renderPreview(job, order, jobId) {
  const art = Object.fromEntries(job.artifacts.map((a) => [a.kind, a.url]));
  const views = [
    ['mockup_jpg', 'Pe perete'], ['painted_png', 'Tabloul terminat'], ['numbered_png', 'Pânza numerotată'],
  ].filter(([k]) => art[k]);
  const img = h('img', { src: art[views[0]?.[0]], alt: views[0]?.[1] ?? '' });
  const tabs = h('div', { class: 'tabs', role: 'tablist' }, views.map(([k, label], i) => h('button', {
    role: 'tab', 'aria-selected': i === 0 ? 'true' : 'false',
    onclick: (e) => {
      img.src = art[k]; img.alt = label;
      tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b === e.target)));
    },
  }, label)));

  const colors = job.recipe?.colors ?? [];
  const stats = job.stats ?? {};
  const side = h('div', {},
    h('div', { class: 'summary' },
      h('span', { class: 'muted' }, 'Vopsea necesară, în total'),
      h('strong', {}, `${Number(job.recipe?.total_paint_ml ?? 0).toLocaleString('ro-RO')} ml`),
      h('span', { class: 'muted' }, `${colors.length} culori · ${stats.num_regions ?? '—'} zone de pictat · nivel ${DIFFICULTY[stats.difficulty] ?? stats.difficulty ?? '—'}`)),
    h('h3', {}, 'Paleta ta'),
    h('ul', { class: 'palette' }, colors.map((c) => h('li', {}, lid(c.number, c.hex),
      h('span', {}, c.hex, h('small', {}, `${c.paint_ml} ml · recipient ${c.pot_ml} ml`))))),
    h('div', { class: 'downloads' },
      art.canvas_pdf && h('a', { href: art.canvas_pdf, download: '' }, 'Pânza (PDF)'),
      art.canvas_svg && h('a', { href: art.canvas_svg, download: '' }, 'Pânza (SVG)'),
      art.recipe_json && h('a', { href: art.recipe_json, download: '' }, 'Rețeta de culori (JSON)')),
    order.status === 'awaiting_approval'
      ? h('div', {},
        h('p', {}, 'Dacă îți place rezultatul, aprobă-l și trecem la plată. Dacă nu, creează o variantă cu alt număr de culori.'),
        h('div', { class: 'row' },
          h('button', {
            class: 'primary',
            onclick: async (e) => {
              e.target.disabled = true;
              try {
                await api(`/v1/orders/${order.id}/approve`, { method: 'POST', body: { jobId } });
                toast('Am aprobat varianta. Urmează plata.');
                route();
              } catch (err) { toast(err.message, true); e.target.disabled = false; }
            },
          }, 'Aprobă varianta'),
          h('a', { class: 'button', href: '#/create' }, 'Încearcă altă variantă')))
      : order.status === 'awaiting_payment'
        ? h('p', { class: 'muted' }, 'Varianta e aprobată. Plata online va fi disponibilă în curând; te contactăm pentru confirmare.')
        : null);
  return h('div', { class: 'preview' }, h('div', {}, tabs, h('div', { class: 'stage' }, img)), side);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
async function route() {
  clearTimeout(pollTimer);
  const hash = location.hash || '#/';
  document.querySelectorAll('.bar nav a').forEach((a) => {
    const target = a.getAttribute('href');
    a.toggleAttribute('aria-current', target === hash || (target === '#/orders' && hash.startsWith('#/order/')));
    if (a.hasAttribute('aria-current')) a.setAttribute('aria-current', 'page');
  });
  try {
    if (hash.startsWith('#/order/')) await renderOrder(hash.slice('#/order/'.length));
    else if (hash === '#/create') await renderCreate();
    else if (hash === '#/orders') await renderOrders();
    else if (hash === '#catalog') {
      if (!document.getElementById('catalog')) await renderCatalog();
      document.getElementById('catalog')?.scrollIntoView();
    }
    else await renderCatalog();
  } catch (err) {
    view.replaceChildren(h('p', { class: 'error' }, err.status === 404 ? 'Nu am găsit această pagină sau comandă.' : `A apărut o eroare: ${err.message}`));
  }
  if (hash !== '#catalog') view.focus({ preventScroll: true });
}

// Întoarcerea din ecranul de consimțământ Google: ?google=connected|denied|...
const googleResult = new URLSearchParams(location.search).get('google');
if (googleResult) {
  const msg = {
    connected: ['Google Photos e conectat. Acum poți alege o poză.', false],
    denied: ['Nu ai acordat acces la Google Photos.', true],
    scope_denied: ['Fără permisiunea pentru poze nu putem prelua fotografia. Bifează accesul la Google Photos.', true],
    invalid_state: ['Conectarea a expirat. Încearcă din nou.', true],
  }[googleResult] ?? ['Conectarea la Google Photos nu a reușit. Încearcă din nou.', true];
  toast(...msg);
  history.replaceState(null, '', location.pathname + location.hash);
}

window.addEventListener('hashchange', route);
renderAccount();
route();
