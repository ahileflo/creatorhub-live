// Construiește PDF-urile de printat (A4) din același motor de desene ca aplicația.
//   node liga/tools/build-pdf.js <folder-ieșire>
// Scoate, în RO și EN:
//   gratuit  — eșantionul (prima serie + prima poveste din fiecare serie)
//   complet  — toate paginile (licență personală)
//   scoli    — poveștile de seară + fișa profesorului pentru fiecare (licență educațională)
//   revista-1 — „revista” nr. 1: bandă desenată + povești + pagini de colorat
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const A = require('../art.js');
const out = path.resolve(process.argv[2] || 'dist');
fs.mkdirSync(out, { recursive: true });
const SITE = 'ahileflo.github.io/creatorhub-live/liga';

const TX = {
  ro: {
    sub: 'Supereroi de colorat, benzi desenate și povești de seară', n: p => p + ' pagini de printat · A4',
    how: 'Printează paginile care îți plac, de câte ori vrei. Colorează și online, pe tabletă:',
    kind: { gratuit: 'Eșantion gratuit', complet: 'Pachetul complet', scoli: 'Pachetul pentru școli', 'revista-1': 'Revista · numărul 1' },
    licT: 'Licență și drepturi de autor',
    licAll: ['© 2026 Liga Creioanelor. Toate personajele, textele și desenele sunt create pentru acest produs și sunt protejate de dreptul de autor.',
      'Nu este permis: să revinzi sau să dai mai departe fișierul; să îl publici pe internet, în grupuri sau pe platforme de materiale; să folosești personajele în alte produse; să ștergi mențiunea de copyright de pe pagini.'],
    lic: {
      personal: ['Licență personală', 'Poți printa și folosi paginile acasă, pentru copiii din familia ta, de câte ori vrei.'],
      scoli: ['Licență educațională', 'Licența de clasă: un cadru didactic poate printa și folosi materialele cu elevii clasei lui. Licența de școală: toate cadrele didactice dintr-o unitate de învățământ pot printa și folosi materialele cu elevii unității. Licența nu se transferă altei unități și nu permite distribuirea fișierului către părinți sau terți.']
    },
    forT: 'Licențiat pentru: ______________________________    Tip: clasă / școală    Data: ____________',
    tch: 'Fișa profesorului', age: 'Vârstă', yrs: 'ani', theme: 'Tema', goal: 'Ce învață copilul', before: 'Înainte de lectură', beforeQ: 'Uitați-vă la desen. Ce credeți că se întâmplă în poveste?',
    talk: 'Discuție după lectură', talk2: ['Ce a simțit personajul la început? Dar la sfârșit?', 'Ce ai fi făcut tu în locul lui?'], act: 'Activitate', min: 'Durată: 20–30 de minute · lectură, discuție, activitate, colorat',
    stu: 'Fișa elevului', name: 'Nume: ____________________   Clasa: ________', learned: 'Ce am învățat azi:', feel: 'Cum m-am simțit:'
  },
  en: {
    sub: 'Superheroes to color, comics and bedtime stories', n: p => p + ' printable pages · A4',
    how: 'Print the pages you like, as many times as you want. Color online on a tablet too:',
    kind: { gratuit: 'Free sample', complet: 'The full pack', scoli: 'The school pack', 'revista-1': 'Magazine · issue 1' },
    licT: 'License and copyright',
    licAll: ['© 2026 Liga Creioanelor. All characters, texts and drawings were created for this product and are protected by copyright.',
      'Not allowed: reselling or passing on the file; publishing it online, in groups or on resource platforms; using the characters in other products; removing the copyright notice from the pages.'],
    lic: {
      personal: ['Personal license', 'You may print and use the pages at home, for the children in your family, as many times as you like.'],
      scoli: ['Education license', 'Classroom license: one teacher may print and use the materials with the pupils of their class. School license: all teachers of one school may print and use the materials with that school\'s pupils. The license does not transfer to another school and does not allow sending the file to parents or third parties.']
    },
    forT: 'Licensed to: ______________________________    Type: classroom / school    Date: ____________',
    tch: 'Teacher\'s sheet', age: 'Age', yrs: 'yrs', theme: 'Theme', goal: 'What the child learns', before: 'Before reading', beforeQ: 'Look at the picture. What do you think happens in the story?',
    talk: 'Discussion after reading', talk2: ['How did the character feel at the start? And at the end?', 'What would you have done in their place?'], act: 'Activity', min: 'Time: 20–30 minutes · reading, discussion, activity, coloring',
    stu: 'Pupil\'s sheet', name: 'Name: ____________________   Class: ________', learned: 'What I learned today:', feel: 'How I felt:'
  }
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const CSS = '@page{size:A4;margin:0}*{margin:0;box-sizing:border-box}body{font-family:"Liberation Sans",Arial,sans-serif;color:#111}' +
  'section{width:210mm;height:297mm;display:flex;align-items:center;justify-content:center;page-break-after:always;overflow:hidden}' +
  'section>svg{width:194mm;height:auto}.cv{flex-direction:column;gap:5mm;text-align:center;padding:12mm}' +
  '.cv h1{font-size:25mm;line-height:.95;font-weight:900;text-transform:uppercase;letter-spacing:-1mm}.cv h2{font-size:6.4mm}.cv p{font-size:4.6mm;line-height:1.4}' +
  '.bd{border:1.2mm solid #111;border-radius:99mm;padding:2mm 7mm;font-weight:900;font-size:5mm;text-transform:uppercase}' +
  '.tx{flex-direction:column;align-items:stretch;justify-content:flex-start;padding:18mm 18mm 14mm;gap:5mm;font-size:4.5mm;line-height:1.5}' +
  '.tx h1{font-size:9mm;line-height:1.1}.tx h3{font-size:4.2mm;text-transform:uppercase;letter-spacing:.3mm;margin-bottom:1mm}' +
  '.tx .bx{border:.8mm solid #111;border-radius:4mm;padding:4mm 5mm}.tx .mt{font-weight:700}.tx small{font-size:3.6mm;color:#444}' +
  '.ln{border-bottom:.4mm solid #111;height:9mm}.fc{display:flex;gap:8mm;margin-top:2mm}.fc i{width:16mm;height:16mm;border:.8mm solid #111;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:8mm}';

function cover(lang, pages, kind) {
  const t = TX[lang], art = A.render('oras', 10, lang).replace('<svg ', '<svg style="width:140mm;display:block;margin:0 auto" ');
  return '<section class="cv"><div class="bd">' + t.kind[kind] + '</div><h1>Liga<br>Creioanelor</h1><h2>' + t.sub + '</h2>' + art +
    '<p><b>' + t.n(pages) + '</b></p><p>' + t.how + '<br><b>' + SITE + '</b></p></section>';
}
function license(lang, which) {
  const t = TX[lang], l = t.lic[which];
  return '<section class="tx"><h1>' + t.licT + '</h1><p>' + t.licAll[0] + '</p><div class="bx"><h3>' + l[0] + '</h3><p>' + l[1] + '</p></div><p>' + t.licAll[1] + '</p>' +
    (which === 'scoli' ? '<p class="mt" style="margin-top:6mm">' + t.forT + '</p>' : '') + '<small>' + SITE + '</small></section>';
}
function teacher(lang, s, p) {
  const t = TX[lang], i = lang === 'en' ? 1 : 0;
  return '<section class="tx"><small>' + t.tch + ' · ' + esc(s.t[i]) + '</small><h1>' + esc(p.t[i]) + '</h1>' +
    '<p class="mt">' + t.age + ': ' + p.ages + ' ' + t.yrs + ' · ' + t.min + '</p>' +
    '<div class="bx"><h3>' + t.goal + '</h3><p>' + esc(p.les[i]) + '</p></div>' +
    '<div><h3>' + t.before + '</h3><p>' + t.beforeQ + '</p></div>' +
    '<div><h3>' + t.talk + '</h3><p>1. ' + esc(p.q[i]) + '<br>2. ' + t.talk2[0] + '<br>3. ' + t.talk2[1] + '</p></div>' +
    '<div class="bx"><h3>' + t.act + '</h3><p>' + esc(p.act[i]) + '</p></div>' +
    '<div style="margin-top:auto"><h3>' + t.stu + '</h3><p>' + t.name + '</p><p style="margin-top:3mm">' + t.learned + '</p><div class="ln"></div><div class="ln"></div><div class="ln"></div>' +
    '<p style="margin-top:4mm">' + t.feel + '</p><div class="fc"><i>🙂</i><i>😐</i><i>🙁</i></div></div></section>';
}
const pageOf = (lang, s, i) => '<section>' + A.render(s, i, lang) + '</section>';

(async () => {
  const b = await chromium.launch(), pg = await b.newPage();
  const all = [], free = [], stories = [];
  A.SERIES.forEach(s => s.pages.forEach((p, i) => { all.push([s.id, i]); if (s.free || (s.story && i === 0)) free.push([s.id, i]); if (s.story) stories.push([s, i]); }));
  const mag = [0, 1, 2, 3, 4, 5, 6, 7].map(i => ['banda', i]).concat([['bani', 0], ['inima', 0], ['eu', 0], ['sarbatori', 0]], [0, 2, 4, 6, 8, 10].map(i => ['oras', i]), [['liga', 0], ['liga', 1]]);
  for (const lang of ['ro', 'en']) {
    const docs = {
      gratuit: cover(lang, free.length, 'gratuit') + free.map(x => pageOf(lang, x[0], x[1])).join('') + license(lang, 'personal'),
      complet: cover(lang, all.length, 'complet') + license(lang, 'personal') + all.map(x => pageOf(lang, x[0], x[1])).join(''),
      scoli: cover(lang, stories.length * 2, 'scoli') + license(lang, 'scoli') + stories.map(x => pageOf(lang, x[0].id, x[1]) + teacher(lang, x[0], x[0].pages[x[1]])).join(''),
      'revista-1': cover(lang, mag.length, 'revista-1') + mag.map(x => pageOf(lang, x[0], x[1])).join('') + license(lang, 'personal')
    };
    for (const name in docs) {
      await pg.setContent('<!DOCTYPE html><meta charset="utf-8"><style>' + CSS + '</style>' + docs[name]);
      const f = path.join(out, 'liga-creioanelor-' + name + (lang === 'en' ? '-en' : '') + '.pdf');
      await pg.pdf({ path: f, format: 'A4', printBackground: true });
      console.log(path.basename(f), Math.round(fs.statSync(f).size / 1024) + ' KB');
    }
  }
  await b.close();
})();
