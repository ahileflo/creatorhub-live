/**
 * Surse de imagini de stoc: Unsplash și Pexels, normalizate la același format.
 *
 * Obligații de respectat (verificați termenii actuali înainte de lansare):
 *  - Unsplash: atribuirea autorului + apelarea `links.download_location`
 *    („download tracking") la fiecare imagine folosită efectiv.
 *  - Ambele licențe interzic vânzarea fotografiilor NEMODIFICATE; produsul nostru
 *    e o lucrare transformată (contururi + paletă), dar păstrăm atribuirea.
 *  - Persoanele identificabile nu au „model release": le marcăm `hasPeople`
 *    și le trimitem la moderare manuală.
 */

/** @typedef {{ origin: 'unsplash'|'pexels', externalId: string, width: number, height: number,
 *              downloadUrl: string, trackUrl?: string, description: string,
 *              author: { name: string, url: string }, attributionUrl: string,
 *              license: string, hasPeople: boolean }} StockCandidate */

const PEOPLE_WORDS = /\b(person|people|man|men|woman|women|girl|boy|child|children|kid|kids|baby|portrait|face|selfie|couple|bride|groom|model|crowd|family|friends)\b/i;

/** Euristică pe textul descriptiv. NU înlocuiește moderarea: doar prioritizează. */
export function looksLikePeople(...texts) {
  return PEOPLE_WORDS.test(texts.filter(Boolean).join(' '));
}

export class UnsplashSource {
  constructor({ accessKey, fetch: f = globalThis.fetch }) {
    this.accessKey = accessKey;
    this.fetch = f;
    this.origin = 'unsplash';
  }

  #headers() {
    return { Authorization: `Client-ID ${this.accessKey}`, 'Accept-Version': 'v1' };
  }

  /** @returns {Promise<StockCandidate[]>} */
  async search(query, { page = 1, perPage = 30, orientation = 'portrait' } = {}) {
    const url = new URL('https://api.unsplash.com/search/photos');
    url.search = new URLSearchParams({
      query, page: String(page), per_page: String(perPage), orientation, content_filter: 'high',
    }).toString();
    const res = await this.fetch(url, { headers: this.#headers() });
    if (!res.ok) throw new Error(`Unsplash search failed: ${res.status}`);
    const body = await res.json();
    return (body.results ?? []).map((p) => ({
      origin: 'unsplash',
      externalId: p.id,
      width: p.width,
      height: p.height,
      // `urls.raw` acceptă parametri imgix: cerem max 4000 px, JPEG calitate 90.
      downloadUrl: `${p.urls.raw}${p.urls.raw.includes('?') ? '&' : '?'}w=4000&fm=jpg&q=90`,
      trackUrl: p.links?.download_location,
      description: p.alt_description ?? p.description ?? '',
      author: { name: p.user?.name ?? '', url: p.user?.links?.html ?? '' },
      attributionUrl: p.links?.html ?? '',
      license: 'Unsplash License',
      hasPeople: looksLikePeople(p.alt_description, p.description, ...(p.tags ?? []).map((t) => t.title)),
    }));
  }

  async download(candidate) {
    // Download tracking cerut de ghidurile API Unsplash (nu returnează imaginea).
    if (candidate.trackUrl) {
      await this.fetch(candidate.trackUrl, { headers: this.#headers() }).catch(() => {});
    }
    const res = await this.fetch(candidate.downloadUrl);
    if (!res.ok) throw new Error(`Unsplash download failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}

export class PexelsSource {
  constructor({ apiKey, fetch: f = globalThis.fetch }) {
    this.apiKey = apiKey;
    this.fetch = f;
    this.origin = 'pexels';
  }

  async search(query, { page = 1, perPage = 30, orientation = 'portrait' } = {}) {
    const url = new URL('https://api.pexels.com/v1/search');
    url.search = new URLSearchParams({
      query, page: String(page), per_page: String(perPage), orientation,
    }).toString();
    const res = await this.fetch(url, { headers: { Authorization: this.apiKey } });
    if (!res.ok) throw new Error(`Pexels search failed: ${res.status}`);
    const body = await res.json();
    return (body.photos ?? []).map((p) => ({
      origin: 'pexels',
      externalId: String(p.id),
      width: p.width,
      height: p.height,
      // Originalul poate avea 6000+ px și 20+ MB; CDN-ul Pexels acceptă redimensionare
      // prin aceiași parametri pe care îi folosește și în `src.large2x`.
      downloadUrl: p.src?.original ? `${p.src.original}?auto=compress&cs=tinysrgb&w=4000` : null,
      description: p.alt ?? '',
      author: { name: p.photographer ?? '', url: p.photographer_url ?? '' },
      attributionUrl: p.url ?? '',
      license: 'Pexels License',
      hasPeople: looksLikePeople(p.alt),
    }));
  }

  async download(candidate) {
    const res = await this.fetch(candidate.downloadUrl);
    if (!res.ok) throw new Error(`Pexels download failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
}

/**
 * Sursă locală: imagini dintr-un folder (fotografii proprii, licențiate sau demo).
 * Folosită pentru demo și pentru importuri manuale; filtrele automate nu se aplică
 * (`trusted`), deoarece operatorul a ales deja imaginile.
 */
export class LocalFolderSource {
  constructor({ dir, author = 'CreatorHub', license = 'Own / licensed' }) {
    this.dir = dir;
    this.origin = 'direct_upload';
    this.trusted = true;
    this.author = author;
    this.license = license;
  }

  async search() {
    const { readdir } = await import('node:fs/promises');
    const files = (await readdir(this.dir)).filter((f) => /\.(jpe?g|png|webp|heic)$/i.test(f)).sort();
    return files.map((f) => ({
      origin: 'direct_upload',
      externalId: `local:${f}`,
      width: 0,
      height: 0,
      downloadUrl: f,
      description: f.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '),
      author: { name: this.author, url: '' },
      attributionUrl: '',
      license: this.license,
      hasPeople: false,
    }));
  }

  async download(candidate) {
    const { readFile } = await import('node:fs/promises');
    const { join, basename } = await import('node:path');
    return readFile(join(this.dir, basename(candidate.downloadUrl)));
  }
}
