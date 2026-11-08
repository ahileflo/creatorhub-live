/**
 * Client minimal pentru Google Photos Picker API (photospicker.googleapis.com/v1).
 *
 * Fluxul:
 *   1. createSession()          → { id, pickerUri, pollingConfig, expireTime }
 *   2. utilizatorul deschide pickerUri și alege pozele în interfața Google
 *   3. getSession(id) periodic  → mediaItemsSet === true când a terminat
 *   4. listMediaItems(id)       → elementele alese (cu mediaFile.baseUrl)
 *   5. download(baseUrl + '=d') → originalul (header Authorization obligatoriu)
 *   6. deleteSession(id)        → curățenie
 *
 * Picker API nu are webhook-uri: pasul 3 rulează server-side, ca job BullMQ
 * întârziat, respectând `pollingConfig.pollInterval` primit de la Google.
 */
export const PICKER_BASE = 'https://photospicker.googleapis.com/v1';

export class PickerApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

/** Durațiile Google sunt string-uri protobuf („5s", „1.5s", „3600s") → milisecunde. */
export function parseDurationMs(value, fallbackMs) {
  const m = /^(\d+(?:\.\d+)?)s$/.exec(String(value ?? ''));
  return m ? Math.round(Number(m[1]) * 1000) : fallbackMs;
}

export class GooglePhotosPicker {
  constructor({ fetch: f = globalThis.fetch, baseUrl = PICKER_BASE } = {}) {
    this.fetch = f;
    this.baseUrl = baseUrl;
  }

  async #call(accessToken, method, path, { query, body } = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, String(v));
    const res = await this.fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new PickerApiError(`Picker API ${method} ${path}: ${res.status}`, res.status, json);
    return json;
  }

  /** @param {{ maxItemCount?: number }} opts — limităm câte poze poate alege clientul. */
  async createSession(accessToken, { maxItemCount = 10 } = {}) {
    const s = await this.#call(accessToken, 'POST', '/sessions', {
      body: { pickingConfig: { maxItemCount: String(maxItemCount) } },
    });
    return normalizeSession(s);
  }

  async getSession(accessToken, sessionId) {
    return normalizeSession(await this.#call(accessToken, 'GET', `/sessions/${encodeURIComponent(sessionId)}`));
  }

  async deleteSession(accessToken, sessionId) {
    await this.#call(accessToken, 'DELETE', `/sessions/${encodeURIComponent(sessionId)}`);
  }

  /** Toate elementele alese (paginare inclusă). */
  async listMediaItems(accessToken, sessionId, { pageSize = 100 } = {}) {
    const items = [];
    let pageToken;
    do {
      const page = await this.#call(accessToken, 'GET', '/mediaItems', { query: { sessionId, pageSize, pageToken } });
      items.push(...(page?.mediaItems ?? []));
      pageToken = page?.nextPageToken;
    } while (pageToken);
    return items;
  }

  /**
   * Descarcă originalul unei fotografii. `baseUrl` expiră după ~60 minute,
   * deci descărcarea se face imediat după listare.
   * @returns {Promise<{ bytes: Buffer, contentType: string }>}
   */
  async downloadPhoto(accessToken, mediaItem, { maxBytes }) {
    const baseUrl = mediaItem?.mediaFile?.baseUrl;
    if (!baseUrl) throw new PickerApiError('Media item without baseUrl', 0, mediaItem);
    const res = await this.fetch(`${baseUrl}=d`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new PickerApiError(`Download failed: ${res.status}`, res.status);
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > maxBytes) throw new PickerApiError(`File too large (${declared} bytes)`, 413);
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > maxBytes) throw new PickerApiError(`File too large (${bytes.length} bytes)`, 413);
    return { bytes, contentType: res.headers.get('content-type') ?? mediaItem.mediaFile.mimeType };
  }
}

function normalizeSession(s) {
  return {
    id: s.id,
    pickerUri: s.pickerUri,
    mediaItemsSet: Boolean(s.mediaItemsSet),
    pollIntervalMs: parseDurationMs(s.pollingConfig?.pollInterval, 5000),
    timeoutMs: parseDurationMs(s.pollingConfig?.timeoutIn, 30 * 60 * 1000),
    expireTime: s.expireTime ? new Date(s.expireTime) : null,
  };
}
