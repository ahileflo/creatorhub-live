# Previzualizarea linkurilor de rețetă (WhatsApp, Facebook, Telegram)

Când trimiți un link pe WhatsApp, aplicația de chat citește din pagină titlul, descrierea și poza (`og:title`, `og:description`, `og:image`). Nu rulează JavaScript, deci pagina trebuie să vină gata făcută de la server.

GitHub Pages găzduiește doar fișiere statice, iar Supabase nu servește pagini HTML (le transformă în text simplu). De aceea există acest server mic, `worker.js`, care rulează gratuit pe Cloudflare Workers (100.000 de cereri pe zi).

```
WhatsApp ──► https://pascugust.<contul-tău>.workers.dev/r/AbCdEf1234
              │  citește rețeta din Supabase (get_shared_recipe)
              │  răspunde cu titlu + descriere + poza de 1200×630
              └► omul care apasă ajunge imediat în aplicație: …/pascugust/?r=AbCdEf1234
```

Poza de previzualizare (`og.jpg`) o face aplicația singură la fiecare „🔗 Distribuie”: poza rețetei, titlul, numărul de pași, timpul și autorul, cu eticheta „Pas cu Gust”. Dacă rețeta nu are poze, se folosește `pascugust/icons/og-app.jpg`.

## Publicare (o singură dată, ~5 minute, gratuit)

### Varianta A: din browser, fără să instalezi nimic
1. Fă-ți cont gratuit pe https://dash.cloudflare.com
2. **Workers & Pages → Create → Create Worker** → nume: `pascugust` → **Deploy**.
3. **Edit code** → șterge tot → lipește conținutul din `share-preview/worker.js` → **Deploy**.
4. **Settings → Variables and Secrets** → adaugă 3 variabile (le găsești în `share-preview/wrangler.toml`):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `APP_URL`
5. Copiază adresa workerului, de forma `https://pascugust.<contul-tău>.workers.dev`.

### Varianta B: din terminal
```bash
cd share-preview
npx wrangler login
npx wrangler deploy
```

### Ultimul pas: legi aplicația de worker
În `pascugust/index.html` pui adresa workerului:
```js
const RK_SHARE_BASE='https://pascugust.<contul-tău>.workers.dev';
```
(sau mi-o trimiți și o pun eu). De acum, „🔗 Distribuie” dă linkuri `…workers.dev/r/…`, iar WhatsApp arată poza rețetei.

## Verificare
- Deschide `https://pascugust.<contul-tău>.workers.dev/r/<id>` în browser: trebuie să ajungi în aplicație, pe rețetă.
- Lipește linkul în https://www.opengraph.xyz sau în debuggerul Facebook (https://developers.facebook.com/tools/debug/): trebuie să vezi poza și titlul.
- WhatsApp ține minte previzualizarea unui link. Dacă ai trimis linkul înainte de worker, testează cu o rețetă distribuită de acum încolo.

## Domeniu propriu (opțional)
Cu un domeniu ca `pascugust.ro` adăugat în Cloudflare, workerul poate răspunde la `https://pascugust.ro/r/…`, iar linkurile arată mult mai bine. În acest caz schimbă `RK_SHARE_BASE` cu noul domeniu.
