// API Paint-by-Numbers — Express.
// Rute principale:
//   GET  /health                               -> self-check (DB + Redis + adâncimea cozii) pentru monitorizare
//   POST /api/orders                           -> creează comanda (după plată — vezi webhook Stripe în README)
//   POST /api/orders/:id/upload-url            -> URL pre-semnat (iCloud / galerie / orice dispozitiv)
//   POST /api/orders/:id/uploaded              -> confirmă upload-ul și pune jobul în coadă
//   GET  /auth/google, /auth/google/callback   -> OAuth Google Photos Picker
//   POST /api/google/sessions                  -> sesiune Picker
//   GET  /api/google/sessions/:id              -> polling
//   POST /api/google/sessions/:id/import       -> importă poza aleasă în comanda dată
//   GET  /api/jobs/:id                         -> status job + fișiere rezultate

import express from 'express';
import session from 'express-session';
import { pool, createOrder } from './db.js';
import { enqueueJob, queueDepth } from './queue.js';
import { presignUpload, putBuffer } from './uploads.js';
import * as google from './googlePhotos.js';

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '100kb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-only',
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 2 * 3600e3 },
}));
app.use(express.static(new URL('../public', import.meta.url).pathname));

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const TIERS = { standard: 0, premium: 10 };

app.get('/health', wrap(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ ok: true, queueDepth: await queueDepth(), time: new Date().toISOString() });
}));

app.post('/api/orders', wrap(async (req, res) => {
  const { email, tier = 'standard', nColors = 24, widthCm = 40, heightCm = 50, source = 'upload' } = req.body;
  if (!email || !TIERS.hasOwnProperty(tier)) return res.status(400).json({ error: 'email/tier invalid' });
  if (![12, 24, 36, 48].includes(nColors)) return res.status(400).json({ error: 'nColors: 12/24/36/48' });
  const id = await createOrder({ email, tier, nColors, widthCm, heightCm, source });
  req.session.orders = [...(req.session.orders || []), id]; // doar cine a creat comanda o poate modifica
  res.status(201).json({ id });
}));

function ownOrder(req) {
  if (!(req.session.orders || []).includes(req.params.id)) {
    throw Object.assign(new Error('Comandă inexistentă'), { status: 404 });
  }
}

async function orderRow(id) {
  const { rows } = await pool.query('SELECT * FROM orders WHERE id=$1', [id]);
  return rows[0];
}

app.post('/api/orders/:id/upload-url', wrap(async (req, res) => {
  ownOrder(req);
  res.json(await presignUpload(req.params.id, req.body.mimeType, Number(req.body.size)));
}));

app.post('/api/orders/:id/uploaded', wrap(async (req, res) => {
  ownOrder(req);
  const o = await orderRow(req.params.id);
  if (!req.body.key?.startsWith(`orders/`) || !req.body.key.includes(`/${o.id}/source/`)) {
    return res.status(400).json({ error: 'cheie invalidă' });
  }
  const jobId = await enqueueJob({ orderId: o.id, sourceKey: req.body.key, nColors: o.n_colors,
    widthCm: Number(o.width_cm), heightCm: Number(o.height_cm), priority: TIERS[o.tier] });
  res.json({ jobId });
}));

app.get('/auth/google', google.authRedirect);
app.get('/auth/google/callback', wrap(google.authCallback));
app.post('/api/google/sessions', wrap(google.createSession));
app.get('/api/google/sessions/:id', wrap(google.getSession));

app.post('/api/google/sessions/:sid/import', wrap(async (req, res) => {
  req.params.id = req.body.orderId; ownOrder(req);
  const o = await orderRow(req.body.orderId);
  const [photo] = await google.fetchPickedItems(req, req.params.sid);
  if (!photo) return res.status(400).json({ error: 'Nicio fotografie selectată' });
  if (photo.width && photo.height && Math.min(photo.width, photo.height) < 1200) {
    // avertizare de calitate: o poză mică nu dă detalii bune pe 40x50 cm
    res.set('X-Quality-Warning', 'low-resolution');
  }
  const key = await putBuffer(o.id, photo.buffer, photo.mimeType);
  const jobId = await enqueueJob({ orderId: o.id, sourceKey: key, nColors: o.n_colors,
    widthCm: Number(o.width_cm), heightCm: Number(o.height_cm), priority: TIERS[o.tier] });
  res.json({ jobId });
}));

app.get('/api/jobs/:id', wrap(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT j.id, j.status, j.error, j.result, j.order_id FROM processing_jobs j WHERE j.id=$1', [req.params.id]);
  const j = rows[0];
  if (!j || !(req.session.orders || []).includes(j.order_id)) return res.status(404).json({ error: 'not found' });
  res.json(j);
}));

app.use((err, _req, res, _next) => {
  if (!err.status || err.status >= 500) console.error(err);
  res.status(err.status || 500).json({ error: err.status ? err.message : 'Eroare internă' });
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`PBN API pe :${port}`));
