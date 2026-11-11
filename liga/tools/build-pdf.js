// Construiește PDF-urile de printat (A4) din același motor de desene ca aplicația.
//   node liga/tools/build-pdf.js <folder-ieșire>
// Scoate: eșantionul gratuit (12 pagini) + pachetul complet (80 de pagini + copertă), în RO și EN.
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const A = require('../art.js');
const out = path.resolve(process.argv[2] || 'dist');
fs.mkdirSync(out, { recursive: true });

const TX = {
  ro: { sub: 'Carte de colorat cu supereroi', n: p => p + ' pagini de printat · A4', how: 'Printează paginile care îți plac, de câte ori vrei. Colorează și online, pe tabletă:', free: 'Eșantion gratuit', full: 'Pachetul complet' },
  en: { sub: 'A superhero coloring book', n: p => p + ' printable pages · A4', how: 'Print the pages you like, as many times as you want. Color online on a tablet too:', free: 'Free sample', full: 'The full pack' }
};
const URL = 'ahileflo.github.io/creatorhub-live/liga';

function cover(lang, pages, kind) {
  const t = TX[lang], art = A.render('oras', 10, lang).replace('<svg ', '<svg style="width:150mm;display:block;margin:0 auto" ');
  return '<section class="cv"><div class="bd">' + t[kind] + '</div><h1>Liga<br>Creioanelor</h1><h2>' + t.sub + '</h2>' + art +
    '<p><b>' + t.n(pages) + '</b></p><p>' + t.how + '<br><b>' + URL + '</b></p></section>';
}
function html(lang, list, kind) {
  return '<!DOCTYPE html><meta charset="utf-8"><style>@page{size:A4;margin:0}*{margin:0;box-sizing:border-box}body{font-family:"Liberation Sans",Arial,sans-serif}' +
    'section{width:210mm;height:297mm;display:flex;align-items:center;justify-content:center;page-break-after:always;overflow:hidden}' +
    'section>svg{width:194mm;height:auto}.cv{flex-direction:column;gap:5mm;text-align:center;padding:12mm}' +
    '.cv h1{font-size:25mm;line-height:.95;font-weight:900;text-transform:uppercase;letter-spacing:-1mm}.cv h2{font-size:7mm}.cv p{font-size:4.6mm;line-height:1.4}' +
    '.bd{border:1.2mm solid #111;border-radius:99mm;padding:2mm 7mm;font-weight:900;font-size:5mm;text-transform:uppercase}</style>' +
    cover(lang, list.length, kind) + list.map(([s, i]) => '<section>' + A.render(s, i, lang) + '</section>').join('');
}
(async () => {
  const b = await chromium.launch(), pg = await b.newPage();
  const all = [], free = [];
  A.SERIES.forEach(s => s.pages.forEach((p, i) => { all.push([s.id, i]); if (s.free) free.push([s.id, i]); }));
  for (const lang of ['ro', 'en']) {
    for (const [name, list, kind] of [['gratuit', free, 'free'], ['complet', all, 'full']]) {
      await pg.setContent(html(lang, list, kind));
      const f = path.join(out, 'liga-creioanelor-' + name + (lang === 'en' ? '-en' : '') + '.pdf');
      await pg.pdf({ path: f, format: 'A4', printBackground: true });
      console.log(f, Math.round(fs.statSync(f).size / 1024) + ' KB', list.length + 1 + ' pagini');
    }
  }
  await b.close();
})();
