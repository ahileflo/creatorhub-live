/**
 * CLI pentru Modulul 1: importă o temă imediat (sau o pune în coadă cu --queue).
 *   node src/catalog/cli.js --theme "lavender field" --category flori --per-source 10
 *   node src/catalog/cli.js --theme "alpine lake" --category peisaje --queue
 */
import { parseArgs } from 'node:util';
import { loadConfig } from '../config.js';
import { createDeps } from '../deps.js';
import { ingestTheme } from './ingest.js';
import { LocalFolderSource } from './stockSources.js';

const { values } = parseArgs({
  options: {
    theme: { type: 'string' },
    category: { type: 'string', default: 'diverse' },
    'per-source': { type: 'string', default: '10' },
    queue: { type: 'boolean', default: false },
    'from-dir': { type: 'string' },      // importă dintr-un folder local în loc de Unsplash/Pexels
    approve: { type: 'boolean', default: false }, // publică direct (fără moderare manuală)
  },
});
if (!values.theme) {
  console.error('Usage: --theme "<search terms>" [--category <c>] [--per-source N] [--queue] [--from-dir <folder>] [--approve]');
  process.exit(2);
}
const deps = await createDeps(loadConfig());
const job = { theme: values.theme, category: values.category, perSource: Number(values['per-source']),
  autoApprove: values.approve };
if (values['from-dir']) {
  console.log(await ingestTheme({ ...deps, sources: [new LocalFolderSource({ dir: values['from-dir'] })] },
    { ...job, perSource: 1000 }));
} else if (values.queue) {
  await deps.queues.ingest.add('catalog-ingest', job);
  console.log('queued', job);
} else {
  if (!deps.sources.length) console.warn('No stock source configured (UNSPLASH_ACCESS_KEY / PEXELS_API_KEY).');
  console.log(await ingestTheme(deps, job));
}
await deps.close();
