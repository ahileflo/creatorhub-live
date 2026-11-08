/**
 * Modulul 1 — ingestorul de catalog.
 *
 * Pentru o temă (ex. „lavender field"): caută în surse, filtrează, descarcă,
 * salvează sursa (dedup), creează designurile de catalog pentru fiecare variantă
 * (nr. culori × format pânză) și pune job-urile de procesare în coada `pbn-catalog`.
 *
 * Rulează ca job în coada `pbn-ingest` (programat zilnic cu upsertJobScheduler)
 * sau manual din CLI (src/catalog/cli.js).
 */
import { withTx } from '../db.js';
import { storeSourceImage } from '../ingest/sourceImages.js';
import { buildEngineParams, createProcessingJob, enqueueProcessingJobs, PRIORITY } from '../jobs/processingJobs.js';

export const DEFAULT_VARIANTS = [
  { numColors: 24, canvasWmm: 400, canvasHmm: 500 },
  { numColors: 36, canvasWmm: 400, canvasHmm: 500 },
  { numColors: 48, canvasWmm: 500, canvasHmm: 650 },
];

const MIN_LONG_SIDE_PX = 2000; // sub atât, pânza de 50 cm pierde detalii

export function slugify(text) {
  return String(text).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

/** Filtre aplicate ÎNAINTE de descărcare (economisim cote API și bandă). */
export function acceptCandidate(c, { allowPeople = false } = {}) {
  if (!c.downloadUrl) return 'no download url';
  if (Math.max(c.width, c.height) < MIN_LONG_SIDE_PX) return 'resolution too low';
  if (c.width > c.height * 1.05) return 'landscape (catalog uses portrait canvases)';
  if (c.hasPeople && !allowPeople) return 'identifiable people (needs model release)';
  return null;
}

/**
 * @param {{ db: import('pg').Pool, storage: any, queues: any, cfg: any, sources: any[], log?: any }} deps
 * @param {{ theme: string, category: string, perSource?: number, variants?: typeof DEFAULT_VARIANTS,
 *           autoApprove?: boolean }} opts
 */
export async function ingestTheme(deps, { theme, category, perSource = 10, variants = DEFAULT_VARIANTS, autoApprove = false }) {
  const { db, storage, queues, cfg, sources, log = console } = deps;
  const report = { theme, considered: 0, skipped: {}, imported: 0, jobs: 0 };
  const skip = (reason) => { report.skipped[reason] = (report.skipped[reason] ?? 0) + 1; };

  for (const source of sources) {
    let candidates;
    try {
      candidates = await source.search(theme, { perPage: Math.min(30, perSource * 3) });
    } catch (err) {
      log.warn?.(`[catalog] ${source.origin} search failed: ${err.message}`);
      continue;
    }
    let taken = 0;
    for (const c of candidates) {
      if (taken >= perSource) break;
      report.considered += 1;
      const reason = acceptCandidate(c);
      if (reason) { skip(reason); continue; }

      const exists = await db.query(
        'SELECT 1 FROM source_images WHERE origin = $1 AND external_id = $2', [c.origin, c.externalId]);
      if (exists.rowCount) { skip('already imported'); continue; }

      let bytes;
      try {
        bytes = await source.download(c);
      } catch (err) {
        skip('download failed');
        log.warn?.(`[catalog] ${c.origin}/${c.externalId}: ${err.message}`);
        continue;
      }

      const jobs = await withTx(db, async (tx) => {
        const src = await storeSourceImage({ db: tx, storage }, {
          origin: c.origin, bytes, externalId: c.externalId, author: c.author, license: c.license,
          attributionUrl: c.attributionUrl, width: c.width, height: c.height, hasPeople: c.hasPeople,
          moderation: autoApprove ? 'approved' : 'pending',
        });
        if (!src.created) return [];
        const baseSlug = slugify(`${theme}-${c.origin}-${c.externalId}`);
        const created = [];
        for (const v of variants) {
          const params = buildEngineParams(v);
          const design = await tx.query(
            `INSERT INTO catalog_designs (source_image_id, slug, title, category, tags,
                                          num_colors, canvas_w_mm, canvas_h_mm)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (source_image_id, num_colors, canvas_w_mm, canvas_h_mm) DO NOTHING
             RETURNING id`,
            [src.id, `${baseSlug}-${v.numColors}c-${v.canvasWmm}x${v.canvasHmm}`,
              titleFrom(c.description, theme), category, [theme], v.numColors, v.canvasWmm, v.canvasHmm]);
          if (!design.rowCount) continue;
          created.push(await createProcessingJob(tx, {
            kind: 'catalog', sourceImage: src, params, engineVersion: cfg.ENGINE_VERSION,
            catalogDesign: { id: design.rows[0].id }, priority: PRIORITY.catalog,
          }));
        }
        return created;
      });
      await enqueueProcessingJobs(queues, jobs);
      taken += 1;
      report.imported += jobs.length ? 1 : 0;
      report.jobs += jobs.length;
    }
  }
  log.info?.(`[catalog] ${JSON.stringify(report)}`);
  return report;
}

function titleFrom(description, theme) {
  const text = (description || theme).trim();
  return text.charAt(0).toUpperCase() + text.slice(1, 120);
}
