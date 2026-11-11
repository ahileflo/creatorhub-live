# Liga Creioanelor — cum o vinzi

Un produs cu supereroi **originali** de colorat: pe tabletă (cu degetul sau creionul digital) și pe hârtie (PDF A4).
Tot conținutul e generat din cod (`art.js`), deci nu există imagini luate de altundeva și nici licențe de verificat.

## Ce există acum

| Ce | Unde | Cât |
|---|---|---|
| Aplicația (PWA, merge offline) | `liga/` → `https://ahileflo.github.io/creatorhub-live/liga/` după merge în `main` | 106 pagini, RO + EN |
| Pagini de colorat și bandă desenată | în aplicație | 72 de pagini + 8 pagini de bandă desenată |
| Povești de seară pe vârste | în aplicație, `stories.js` | 26 de povești, 4 serii |
| Fabrica de eroi | în aplicație | eroi noi generați la nesfârșit |
| PDF gratuit (momeală) | `liga/print/liga-creioanelor-gratuit.pdf` (+ `-en`) | 16 pagini |

Produsele plătite **nu sunt în repo** (repo-ul e public). Se generează cu `node liga/tools/build-pdf.js <folder>`:

| Fișier | Pentru cine | Conținut |
|---|---|---|
| `liga-creioanelor-complet.pdf` | familii | toate cele 106 pagini, licență personală |
| `liga-creioanelor-scoli.pdf` | profesori, școli | 26 de povești + fișa profesorului la fiecare, licență educațională |
| `liga-creioanelor-revista-1.pdf` | familii | „revista” nr. 1: banda desenată, 4 povești, 8 pagini de colorat |

Fiecare are și varianta în engleză (`-en`). Licențele sunt descrise în `LICENTA.md`, oferta pentru școli în `SCOLI.md`.

## Ce e gratuit și ce e plătit

- **Gratuit:** seria „Liga se prezintă” (12 pagini), primele 2 pagini din fiecare serie (și primele 2 povești), prima pagină de bandă desenată, 3 eroi pe zi din Fabrica de eroi, printarea paginilor una câte una.
- **Pachetul complet (plată unică):** toate cele 106 pagini, printarea unei serii întregi dintr-o apăsare, Fabrica de eroi fără limită, plus PDF-urile complete.

## Pașii de lansare

1. **Gumroad** → produs nou „Liga Creioanelor — pachetul complet”. Urcă `liga-creioanelor-complet.pdf` și `liga-creioanelor-complet-en.pdf`. Revista și pachetul pentru școli se pun ca produse separate.
2. În pagina de după plată (câmpul *Receipt / custom message*) scrie codul de deblocare al aplicației. Codul îl ai din conversația în care a fost construită aplicația; **nu îl pune în repo**.
3. Copiază linkul produsului în `BUY_URL` din `liga/index.html` (acum duce la magazinul tău, `woopsahile.gumroad.com`).
4. Fă merge în `main`: GitHub Pages publică singur.
5. Pune PDF-ul gratuit ca produs de 0 lei pe Gumroad: așa strângi adrese de email ale părinților.

Preț de pornire propus: **5,99 $ / 29 lei**, de testat. E o ipoteză, nu un rezultat măsurat.

## De știut

- **Blocarea e simplă, nu e seif.** Codul se verifică în browser (amprentă SHA-256) și e același pentru toți cumpărătorii. Cineva priceput îl poate ocoli sau da mai departe. Pentru un produs de câțiva lei e suficient; dacă vânzările cresc, următorul pas e verificarea licenței Gumroad pe server.
- **Schimbarea codului:** generează unul nou, calculează-i SHA-256 și înlocuiește amprenta din `CODES` (poți ține mai multe amprente valide în același timp).
- **Copii și date:** aplicația nu are cont, reclame sau analitice. Desenele se păstrează doar pe dispozitiv (IndexedDB).
- **Personaje:** toate sunt create pentru acest produs. Nu adăuga personaje, nume sau logo-uri din desene existente: sunt mărci înregistrate.

## Cum adaugi conținut

Fiecare pagină e o linie în `SERIES` din `art.js`: titlu RO, titlu EN, personaje cu poză (`cur:fly`), decor.
O serie nouă de 12 pagini înseamnă 12 linii. Un decor nou e o funcție în `SCENES`; un erou nou e o linie în `CAST`.
