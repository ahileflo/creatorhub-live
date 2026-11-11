/* Liga Creioanelor — motorul de desene.
   Toate paginile de colorat sunt generate din cod (SVG vectorial): personaje 100% originale,
   fără imagini luate de altundeva. Același fișier rulează în aplicație și în tools/build-pdf.js. */
(function (root) {
  'use strict';

  var W = 800, H = 1100, SW = 4.5;
  var uid = 0;

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function f(n) { return Math.round(n * 10) / 10; }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  // --- primitive: .f = zonă care se colorează, .d = linie de detaliu, .k = negru plin, .w = alb fix
  function P(d, x) { return '<path class="f" d="' + d + '" ' + (x || '') + '/>'; }
  function D(d, x) { return '<path class="d" d="' + d + '" ' + (x || '') + '/>'; }
  function C(cx, cy, r, x) { return '<circle class="f" cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '" ' + (x || '') + '/>'; }
  function E(cx, cy, rx, ry, x) { return '<ellipse class="f" cx="' + f(cx) + '" cy="' + f(cy) + '" rx="' + f(rx) + '" ry="' + f(ry) + '" ' + (x || '') + '/>'; }
  function RC(x, y, w, h, r, ex) { return '<rect class="f" x="' + f(x) + '" y="' + f(y) + '" width="' + f(w) + '" height="' + f(h) + '" rx="' + (r || 0) + '" ' + (ex || '') + '/>'; }
  function K(cx, cy, r) { return '<circle class="k" cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '"/>'; }
  function G(t, inner, ex) { return '<g transform="' + t + '" ' + (ex || '') + '>' + inner + '</g>'; }
  function place(x, y, s, inner, rot, flip) {
    return '<g transform="translate(' + f(x) + ' ' + f(y) + ') ' + (rot ? 'rotate(' + rot + ') ' : '') +
      'scale(' + (flip ? -s : s) + ' ' + s + ')" stroke-width="' + f(SW / s) + '">' + inner + '</g>';
  }
  function clip(shape, inner) {
    var id = 'c' + (++uid);
    return '<clipPath id="' + id + '">' + shape + '</clipPath><g clip-path="url(#' + id + ')">' + inner + '</g>';
  }

  function bumpy(cx, cy, rx, ry, n, rot) {
    var pts = [], i, a;
    for (i = 0; i < n; i++) { a = (rot || 0) + i / n * Math.PI * 2; pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); }
    var d = 'M' + f(pts[0][0]) + ' ' + f(pts[0][1]);
    for (i = 1; i <= n; i++) {
      var p = pts[i % n], q = pts[i - 1], r = Math.hypot(p[0] - q[0], p[1] - q[1]) * 0.6;
      d += 'A' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(p[0]) + ' ' + f(p[1]);
    }
    return d + 'Z';
  }
  function star(cx, cy, R, r, n, rot) {
    var d = '', i, a, q;
    if (rot == null) rot = -Math.PI / 2;
    for (i = 0; i < n * 2; i++) { a = rot + i * Math.PI / n; q = i % 2 ? r : R; d += (i ? 'L' : 'M') + f(cx + q * Math.cos(a)) + ' ' + f(cy + q * Math.sin(a)); }
    return d + 'Z';
  }
  function txt(s, x, y, size, cls, ex) {
    return '<text class="' + (cls || 'f t') + '" x="' + f(x) + '" y="' + f(y) + '" font-size="' + f(size) + '" text-anchor="middle" ' + (ex || '') + '>' + esc(s) + '</text>';
  }

  // ================= PERSONAJE =================
  var EMB = {
    star: function () { return P(star(0, 0, 20, 9, 5)); },
    bolt: function () { return P('M7 -22L-14 4H-2L-8 22L14 -6H2Z'); },
    drop: function () { return P('M0 -22C13 -4 16 4 16 8A16 16 0 1 1 -16 8C-16 4 -13 -4 0 -22Z'); },
    leaf: function () { return P('M0 -22C22 -12 20 14 0 22C-20 14 -22 -12 0 -22Z') + D('M0 -16V18'); },
    flame: function () { return P('M0 -24C4 -10 18 -6 14 10C12 20 4 24 0 24C-6 24 -14 18 -14 8C-14 0 -8 -2 -6 -10C-2 -6 -2 -16 0 -24Z'); },
    moon: function () { return P('M8 -20A22 22 0 1 0 8 20A16 16 0 1 1 8 -20Z'); },
    heart: function () { return P('M0 20C-28 0 -18 -22 0 -8C18 -22 28 0 0 20Z'); },
    sun: function () { return C(0, 0, 10) + D('M0 -22V-15M0 15V22M-22 0H-15M15 0H22M-15 -15L-11 -11M11 11L15 15M-15 15L-11 11M11 -11L15 -15'); },
    none: function () { return ''; }
  };

  var POSES = {
    stand: { la: 22, ra: 22, ll: 6, rl: 6 },
    hero: { la: 38, ra: 152, ll: 12, rl: 12 },
    power: { la: 150, ra: 150, ll: 14, rl: 14 },
    fly: { la: 25, ra: 172, ll: 5, rl: -3, rot: 52, dy: -170 },
    run: { la: 75, ra: 120, ll: 32, rl: -12, rot: 8 },
    wave: { la: 20, ra: 138, ll: 6, rl: 6 },
    jump: { la: 118, ra: 118, ll: 34, rl: 34, dy: -70 },
    point: { la: 20, ra: 96, ll: 8, rl: 8 }
  };

  function arm(sx, sy, s, ang) {
    return G('translate(' + f(s * sx) + ' ' + sy + ') rotate(' + (-s * ang) + ')',
      RC(-16, -12, 32, 92, 16) + RC(-19, 62, 38, 28, 10) + C(0, 104, 22));
  }
  function leg(hx, hy, s, ang) {
    return G('translate(' + f(s * hx) + ' ' + hy + ') rotate(' + (-s * ang) + ')',
      RC(-21, -6, 42, 78, 14) +
      G('scale(' + s + ' 1)', P('M-23 62H23V90C23 100 46 98 46 113H-23Z')));
  }

  function hairBack(h) {
    var t = h.hair, o = '';
    if (t === 'bob') o += E(0, -138, 116, 106);
    if (t === 'pony') o += P('M70 -222Q168 -262 178 -168Q182 -100 138 -78Q152 -140 118 -166Q96 -180 70 -190Z');
    if (t === 'buns') o += C(-78, -232, 36) + C(78, -232, 36);
    if (h.mask === 'cowl') o += P('M-86 -196L-74 -282L-28 -226Z') + P('M86 -196L74 -282L28 -226Z');
    else if (t !== 'helmet') o += C(-95, -142, 15) + C(95, -142, 15);
    return o;
  }
  function hairFront(h) {
    var t = h.hair;
    if (t === 'spiky') return P('M-98 -158L-112 -216L-72 -202L-62 -254L-26 -218L0 -266L28 -218L62 -252L72 -202L112 -214L98 -158Q50 -196 0 -190Q-50 -196 -98 -158Z');
    if (t === 'bob' || t === 'pony' || t === 'buns') return P('M-98 -150Q-104 -252 0 -248Q104 -252 98 -150Q64 -206 12 -202Q-8 -180 -40 -190Q-72 -190 -98 -150Z');
    if (t === 'curly') {
      var pts = [], i, a, d;
      for (i = 0; i <= 8; i++) { a = (195 + i * 18.75) * Math.PI / 180; pts.push([108 * Math.cos(a), -150 + 104 * Math.sin(a)]); }
      d = 'M' + f(pts[0][0]) + ' ' + f(pts[0][1]);
      for (i = 1; i < pts.length; i++) { var r = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) * 0.62; d += 'A' + f(r) + ' ' + f(r) + ' 0 0 1 ' + f(pts[i][0]) + ' ' + f(pts[i][1]); }
      return P(d + 'Q60 -200 0 -196Q-60 -200 ' + f(pts[0][0]) + ' ' + f(pts[0][1]) + 'Z');
    }
    if (t === 'mohawk') return P('M-30 -226L-40 -276L-16 -250L0 -292L16 -250L40 -276L30 -226Q0 -238 -30 -226Z');
    if (t === 'helmet') return P('M-106 -150A106 104 0 0 1 106 -150Q0 -176 -106 -150Z') + RC(-112, -158, 224, 20, 10) + D('M0 -254V-282') + C(0, -292, 11);
    if (t === 'tophat') return RC(-62, -344, 124, 96, 8) + RC(-62, -262, 124, 26, 0) + E(0, -234, 114, 17);
    return '';
  }
  function head(h) {
    var o = hairBack(h), m = h.mask, eyes = m !== 'visor', s;
    o += E(0, -150, 96, 90);
    var inner = '';
    if (m === 'domino') inner = P('M-112 -178Q0 -198 112 -178V-128Q55 -116 0 -134Q-55 -116 -112 -128Z');
    if (m === 'cowl') inner = P('M-112 -262H112V-118Q55 -136 0 -122Q-55 -136 -112 -118Z');
    if (m === 'goggles') inner = RC(-112, -162, 224, 18, 0);
    if (inner) o += clip('<ellipse cx="0" cy="-150" rx="96" ry="90"/>', inner) + '<ellipse class="d" cx="0" cy="-150" rx="96" ry="90"/>';
    if (m === 'visor') o += RC(-86, -178, 172, 50, 25) + D('M-58 -164H-18M-4 -164H8');
    if (m === 'goggles') o += C(-38, -152, 31) + C(38, -152, 31);
    if (m === 'monocle') o += C(38, -152, 29) + D('M62 -136Q84 -96 70 -62');
    if (eyes) for (s = -1; s <= 1; s += 2) {
      o += '<ellipse class="w" cx="' + (s * 38) + '" cy="-152" rx="16" ry="21"/>' + K(s * 38 + 3, -149, 9) + '<circle class="w n" cx="' + (s * 38 + 6) + '" cy="-153" r="3"/>';
    }
    var fc = h.face || 'smile';
    if (fc === 'smile') o += D('M-26 -112Q0 -88 26 -112');
    if (fc === 'open') o += P('M-26 -114Q0 -76 26 -114Z');
    if (fc === 'smirk') o += D('M-18 -106Q6 -94 28 -112');
    if (fc === 'angry') o += D('M-22 -92Q0 -104 22 -92') + D('M-60 -186L-22 -174M60 -186L22 -174');
    if (h.must) o += P('M0 -122C-20 -136 -44 -124 -60 -108C-40 -106 -20 -102 0 -113C20 -102 40 -106 60 -108C44 -124 20 -136 0 -122Z');
    return o + hairFront(h);
  }

  function hero(h, poseName) {
    var p = POSES[poseName] || POSES.stand, k = h.big ? 1.28 : 1, o = '';
    var sh = 62 * k, wa = 46 * k;
    if (h.cape) o += P('M' + f(-sh + 4) + ' -60H' + f(sh - 4) + 'Q112 40 124 152Q92 136 72 152Q42 136 22 152Q0 136 -22 152Q-42 136 -72 152Q-92 136 -124 152Q-112 40 ' + f(-sh + 4) + ' -60Z');
    o += leg(24 * k, 66, -1, p.ll) + leg(24 * k, 66, 1, p.rl);
    if (h.skirt) o += P('M' + f(-wa - 2) + ' 62H' + f(wa + 2) + 'L' + f(wa + 30) + ' 112Q0 130 ' + f(-wa - 30) + ' 112Z');
    o += P('M' + f(-sh) + ' -64H' + f(sh) + 'Q' + f(sh + 8) + ' 0 ' + f(wa) + ' 72H' + f(-wa) + 'Q' + f(-sh - 8) + ' 0 ' + f(-sh) + ' -64Z');
    o += RC(-wa - 2, 48, wa * 2 + 4, 24, 6) + RC(-13, 46, 26, 28, 5);
    if (h.emblem && h.emblem !== 'none') o += C(0, -4, 30) + G('translate(0 -4)', EMB[h.emblem]());
    o += arm(sh - 4, -44, -1, p.la) + arm(sh - 4, -44, 1, p.ra);
    return o + head(h);
  }

  function robot() {
    var o = D('M0 -238V-262') + C(0, -274, 13);
    o += RC(-84, -238, 168, 124, 26) + C(-38, -180, 24) + C(38, -180, 24) + K(-38, -180, 9) + K(38, -180, 9);
    o += RC(-36, -142, 72, 16, 8) + D('M-12 -142V-126M12 -142V-126');
    o += RC(-98, -196, 16, 40, 6) + RC(82, -196, 16, 40, 6);
    o += RC(-18, -114, 36, 20, 4);
    o += arm(70, -70, -1, 28) + arm(70, -70, 1, 150);
    o += RC(-74, -96, 148, 150, 24) + RC(-48, -74, 96, 52, 10) + D('M-36 -48L-20 -62L-4 -40L14 -58L34 -48');
    o += C(-34, 6, 11) + C(0, 6, 11) + C(34, 6, 11);
    o += RC(-52, 54, 38, 88, 10) + RC(14, 54, 38, 88, 10) + RC(-66, 136, 62, 42, 14) + RC(4, 136, 62, 42, 14);
    return o;
  }
  function cat() {
    var o = P('M52 120C120 130 150 70 122 20C112 4 92 12 100 30C114 62 92 92 52 88Z');
    o += P('M-70 60L-52 -12L52 -12L70 60Q84 150 0 150Q-84 150 -70 60Z');
    o += P('M-58 -8H58L84 120Q0 96 -84 120Z', 'opacity="1"');
    o += E(0, 86, 36, 50);
    o += E(-40, 162, 34, 18) + E(40, 162, 34, 18);
    o += P('M-78 -150L-92 -238L-26 -196Z') + P('M78 -150L92 -238L26 -196Z');
    o += C(0, -110, 92);
    o += clip('<circle cx="0" cy="-110" r="92"/>', P('M-100 -140Q0 -160 100 -140V-92Q50 -80 0 -98Q-50 -80 -100 -92Z')) + '<circle class="d" cx="0" cy="-110" r="92"/>';
    for (var s = -1; s <= 1; s += 2) o += '<ellipse class="w" cx="' + (s * 36) + '" cy="-116" rx="15" ry="19"/>' + '<ellipse class="k" cx="' + (s * 36) + '" cy="-114" rx="6" ry="13"/>';
    o += '<path class="k" d="M-9 -82H9L0 -70Z"/>' + D('M0 -70V-62M0 -62Q-12 -50 -24 -60M0 -62Q12 -50 24 -60');
    o += D('M-50 -72L-112 -84M-50 -62L-110 -56M50 -72L112 -84M50 -62L110 -56');
    return o;
  }
  function blot(seed) {
    var r = rng(seed || 1), n = 7 + Math.floor(r() * 3);
    var o = E(-36, 168, 34, 14) + E(36, 168, 34, 14);
    o += P(bumpy(0, 40, 118, 112, n, r() * 6));
    for (var s = -1; s <= 1; s += 2) o += '<circle class="w" cx="' + (s * 38) + '" cy="14" r="24"/>' + K(s * 38 - s * 4, 18, 10);
    o += D('M-78 -22L-18 -4M78 -22L18 -4');
    o += P('M-46 70L-30 88L-15 70L0 88L15 70L30 88L46 70Q0 120 -46 70Z');
    return o;
  }

  var CAST = {
    cur: { n: ['Căpitan Curcubeu', 'Captain Rainbow'], hair: 'spiky', mask: 'domino', emblem: 'star', cape: 1 },
    ful: { n: ['Fulgerica', 'Zippy Bolt'], hair: 'pony', mask: 'goggles', emblem: 'bolt', skirt: 1, face: 'open' },
    tun: { n: ['Tunet', 'Big Thunder'], hair: 'mohawk', mask: 'visor', emblem: 'sun', big: 1, face: 'smirk' },
    und: { n: ['Unda', 'Wave Girl'], hair: 'bob', mask: 'domino', emblem: 'drop', cape: 1 },
    fru: { n: ['Frunză', 'Leafy'], hair: 'curly', mask: 'none', emblem: 'leaf', cape: 1, face: 'open' },
    sca: { n: ['Scânteia', 'Sparky'], hair: 'buns', mask: 'domino', emblem: 'flame', skirt: 1, cape: 1 },
    lun: { n: ['Luna', 'Moonlight'], hair: 'none', mask: 'cowl', emblem: 'moon', cape: 1, face: 'smirk' },
    nor: { n: ['Norișor', 'Little Cloud'], hair: 'helmet', mask: 'none', emblem: 'heart', cape: 1, face: 'open' },
    bar: { n: ['Baronul Gri', 'Baron Grey'], hair: 'tophat', mask: 'monocle', emblem: 'none', cape: 1, face: 'angry', must: 1 },
    pix: { n: ['Robo-Pix', 'Robo-Pix'], fn: robot },
    mat: { n: ['Motanul Mască', 'Masked Kitty'], fn: cat },
    pat: { n: ['Petele', 'The Blots'], fn: blot }
  };
  function figure(id, pose, seed) {
    var c = typeof id === 'string' ? CAST[id] : id;
    return c.fn ? c.fn(seed) : hero(c, pose);
  }

  // ================= DECORURI =================
  function cloud(x, y, w) { return P(bumpy(x, y, w / 2, w / 4.6, 8, 0.2)); }
  function sun(x, y, r) {
    var o = '', i, a;
    for (i = 0; i < 10; i++) { a = i / 10 * Math.PI * 2; o += P('M' + f(x + (r + 12) * Math.cos(a - .12)) + ' ' + f(y + (r + 12) * Math.sin(a - .12)) + 'L' + f(x + (r + 46) * Math.cos(a)) + ' ' + f(y + (r + 46) * Math.sin(a)) + 'L' + f(x + (r + 12) * Math.cos(a + .12)) + ' ' + f(y + (r + 12) * Math.sin(a + .12)) + 'Z'); }
    return o + C(x, y, r);
  }
  function rainbow(cx, cy, R, b, n) {
    var o = '', i, r1, r2;
    for (i = 0; i < n; i++) { r1 = R - i * b; r2 = r1 - b; o += P('M' + f(cx - r1) + ' ' + cy + 'A' + r1 + ' ' + r1 + ' 0 0 1 ' + f(cx + r1) + ' ' + cy + 'H' + f(cx + r2) + 'A' + r2 + ' ' + r2 + ' 0 0 0 ' + f(cx - r2) + ' ' + cy + 'Z'); }
    return o;
  }
  function tree(x, y, s) {
    return place(x, y, s, P('M-22 0L-16 -150H16L22 0Z') + P(bumpy(0, -220, 120, 100, 9, 0.3)) + D('M-40 -200Q-20 -220 0 -200M20 -250Q40 -270 60 -250'));
  }
  function flower(x, y, s) {
    var o = D('M0 0V-70') + P('M0 -30Q24 -52 34 -30Q16 -20 0 -30Z'), i, a;
    for (i = 0; i < 5; i++) { a = i / 5 * Math.PI * 2 - Math.PI / 2; o += C(22 * Math.cos(a), -92 + 22 * Math.sin(a), 15); }
    return place(x, y, s, o + C(0, -92, 12));
  }
  function mushroom(x, y, s) {
    return place(x, y, s, P('M-18 0Q-22 -40 -14 -62H14Q22 -40 18 0Z') + P('M-70 -60A70 62 0 0 1 70 -60Q0 -44 -70 -60Z') + C(-30, -86, 11) + C(12, -100, 13) + C(40, -76, 9));
  }
  function fish(x, y, s, flip) {
    return place(x, y, s, P('M52 0L96 -34V34Z') + E(0, 0, 62, 36) + P('M-8 -34Q14 -62 34 -30Z') + D('M-16 -30Q-4 0 -16 30M12 -32Q24 0 12 32') + '<circle class="w" cx="-36" cy="-8" r="10"/>' + K(-38, -8, 4.5) + D('M-58 8Q-50 14 -44 10'), 0, flip);
  }
  function weed(x, y, h) {
    return P('M' + (x - 14) + ' ' + y + 'Q' + (x - 40) + ' ' + f(y - h * .25) + ' ' + (x - 12) + ' ' + f(y - h * .5) + 'Q' + (x + 16) + ' ' + f(y - h * .75) + ' ' + (x - 6) + ' ' + f(y - h) + 'Q' + (x + 44) + ' ' + f(y - h * .75) + ' ' + (x + 16) + ' ' + f(y - h * .5) + 'Q' + (x - 10) + ' ' + f(y - h * .25) + ' ' + (x + 14) + ' ' + y + 'Z');
  }
  function rocket(x, y, s, rot) {
    return place(x, y, s, P('M-34 60L-70 110L-30 96Z') + P('M34 60L70 110L30 96Z') + P('M-18 104Q0 170 18 104Z') +
      P('M0 -130C44 -84 44 20 34 100H-34C-44 20 -44 -84 0 -130Z') + P('M-31 -66Q0 -84 31 -66Q16 -112 0 -130Q-16 -112 -31 -66Z') + C(0, -18, 22) + C(0, -18, 12) + RC(-34, 60, 68, 16, 0), rot);
  }
  function ufo(x, y, s) {
    return place(x, y, s, P('M-56 -8A56 60 0 0 1 56 -8Z') + E(0, 8, 118, 32) + C(-70, 10, 10) + C(-24, 20, 10) + C(24, 20, 10) + C(70, 10, 10) + P('M-40 38L-80 150H80L40 38Z', 'stroke-dasharray="14 12"'));
  }
  function octopus(x, y, s) {
    var o = '', i;
    for (i = 0; i < 5; i++) { var dx = -80 + i * 40; o += P('M' + (dx - 14) + ' 20Q' + (dx - 34) + ' 80 ' + (dx - 8) + ' 130Q' + (dx + 6) + ' 150 ' + (dx + 16) + ' 128Q' + (dx - 4) + ' 80 ' + (dx + 14) + ' 20Z'); }
    return place(x, y, s, o + P('M-96 30C-110 -100 110 -100 96 30Q0 54 -96 30Z') + '<circle class="w" cx="-32" cy="-20" r="17"/><circle class="w" cx="32" cy="-20" r="17"/>' + K(-30, -18, 8) + K(34, -18, 8) + D('M-18 14Q0 30 18 14'));
  }
  function chest(x, y, s) {
    return place(x, y, s, RC(-80, -40, 160, 90, 8) + P('M-80 -40A80 56 0 0 1 80 -40Z') + RC(-14, -54, 28, 40, 6) + D('M-80 -10H80') + C(-46, -78, 12) + C(40, -84, 10) + P(star(4, -106, 20, 9, 5)));
  }
  function burst(x, y, word, rot) {
    var n = 12, d = star(0, 0, 118, 76, n, 0.2);
    return G('translate(' + x + ' ' + y + ') rotate(' + (rot || -8) + ')', P(d) + txt(word, 0, 16, Math.min(48, 240 / Math.max(4, word.length) * 1.5)));
  }

  var SCENES = {
    spot: function (r) {
      var o = '', i, n = 14, cx = 400, cy = 600, a1, a2;
      for (i = 0; i < n; i++) { a1 = i / n * Math.PI * 2; a2 = (i + 1) / n * Math.PI * 2; o += P('M' + cx + ' ' + cy + 'L' + f(cx + 1100 * Math.cos(a1)) + ' ' + f(cy + 1100 * Math.sin(a1)) + 'L' + f(cx + 1100 * Math.cos(a2)) + ' ' + f(cy + 1100 * Math.sin(a2)) + 'Z'); }
      o += P(star(120, 150, 54, 24, 5)) + P(star(690, 210, 44, 19, 5)) + P(star(660, 860, 36, 16, 5)) + P(star(110, 820, 40, 17, 5)) + C(400, 930, 0.1);
      return o + E(400, 905, 250, 44);
    },
    city: function (r) {
      var o = sun(650, 150, 58) + cloud(190, 150, 210) + cloud(430, 270, 150), x = 20, i, j, k;
      while (x < 780) {
        var w = 96 + Math.floor(r() * 5) * 14, h = 220 + Math.floor(r() * 300), top = 820 - h, roof = Math.floor(r() * 4);
        if (x + w > 760) w = 780 - x;
        if (roof === 0) o += P('M' + x + ' ' + top + 'L' + f(x + w / 2) + ' ' + (top - 50) + 'L' + (x + w) + ' ' + top + 'Z');
        if (roof === 1) o += D('M' + f(x + w / 2) + ' ' + top + 'V' + (top - 60)) + C(x + w / 2, top - 66, 8);
        if (roof === 2) o += RC(x + w * .2, top - 34, w * .6, 34, 4);
        o += RC(x, top, w, h + 4, 0);
        var cols = Math.max(1, Math.floor((w - 24) / 38)), rows = Math.min(4, Math.floor((h - 40) / 62)), gap = (w - cols * 26) / (cols + 1);
        for (j = 0; j < rows; j++) for (k = 0; k < cols; k++) o += RC(x + gap + k * (26 + gap), top + 28 + j * 62, 26, 34, 3);
        x += w;
      }
      o += RC(0, 820, 800, 300, 0) + RC(0, 868, 800, 92, 0);
      for (i = 0; i < 6; i++) o += RC(40 + i * 135, 906, 70, 14, 4);
      return o;
    },
    space: function (r) {
      var o = '', i, x, y;
      for (i = 0; i < 11; i++) { x = 50 + r() * 700; y = 50 + r() * 680; if (x > 230 && x < 570 && y > 300) x = x < 400 ? x - 190 : x + 190; o += P(star(x, y, 16 + r() * 14, 7 + r() * 5, r() < .5 ? 4 : 5)); }
      o += E(150, 205, 138, 30) + C(150, 200, 82) + D('M82 170Q150 196 220 166M74 214Q150 244 228 216') + D('M70 222Q150 262 232 222');
      o += C(668, 392, 44) + C(654, 380, 10) + C(684, 406, 8);
      o += ufo(600, 170, .62);
      o += P('M0 880Q400 770 800 880V1100H0Z') + E(130, 940, 52, 17) + E(640, 930, 64, 20) + E(360, 900, 40, 13) + E(520, 1010, 36, 11);
      return o;
    },
    sea: function (r) {
      var o = P('M0 0H800V120Q740 160 680 120T560 120T440 120T320 120T200 120T80 120T0 110Z'), i;
      for (i = 0; i < 9; i++) o += C(i % 2 ? 60 + r() * 140 : 600 + r() * 150, 190 + r() * 560, 9 + r() * 14);
      o += fish(140, 300, .9, true) + fish(660, 250, .7) + fish(680, 610, 1) + fish(110, 640, .6, true);
      o += weed(70, 940, 250) + weed(140, 940, 170) + weed(700, 940, 280) + weed(630, 940, 180);
      o += P('M0 910Q110 866 220 896T420 890T620 900T800 884V1100H0Z');
      o += P(star(250, 950, 34, 15, 5)) + P('M520 968A44 40 0 0 1 608 968Z') + D('M564 968V930M544 968L536 936M584 968L592 936');
      o += P(bumpy(396, 960, 40, 26, 6));
      return o;
    },
    forest: function (r) {
      var o = sun(130, 150, 52) + cloud(420, 140, 200) + cloud(680, 250, 150);
      o += P('M0 700Q200 560 400 680T800 640V1100H0Z');
      o += tree(110, 860, 1.25) + tree(700, 850, 1.35) + tree(250, 760, .7) + tree(570, 750, .65);
      o += P('M0 850Q200 800 400 840T800 830V1100H0Z');
      o += mushroom(190, 950, .8) + mushroom(640, 960, 1) + mushroom(250, 968, .5);
      o += flower(60, 960, .8) + flower(330, 962, .7) + flower(500, 958, .75) + flower(745, 950, .8);
      o += P(bumpy(440, 935, 60, 30, 7));
      return o;
    },
    sky: function (r) {
      var o = rainbow(400, 800, 380, 34, 5) + sun(660, 150, 56);
      o += cloud(160, 170, 240) + cloud(420, 110, 150) + cloud(120, 790, 300) + cloud(680, 800, 300) + cloud(400, 880, 380) + cloud(90, 480, 150) + cloud(720, 500, 140);
      o += D('M250 300Q264 284 278 300Q292 284 306 300M520 330Q532 316 544 330Q556 316 568 330M330 220Q340 208 350 220Q360 208 370 220');
      return o;
    },
    lair: function (r) {
      var o = C(130, 150, 70) + C(108, 132, 14) + C(150, 172, 10) + C(160, 120, 8), i;
      o += P(bumpy(560, 120, 150, 50, 9, .1)) + P('M560 160L520 230H552L530 290L600 210H566L590 160Z');
      o += P('M-40 820L140 420L320 820Z') + P('M140 420L100 508L128 492L150 520L170 494L196 506Z');
      o += P('M480 820L680 360L880 820Z') + P('M680 360L632 470L664 452L688 486L712 454L744 474Z');
      // castel
      o += P('M230 820V470H258V440H292V470H326V440H360V470H394V440H428V470H462V440H496V470H570V820Z');
      o += P('M200 820V380H190V340H220V360H246V340H276V360H302V340H332V380H322V820Z') + P('M186 340L261 220L336 340Z');
      o += P('M478 820V380H468V340H498V360H524V340H554V360H580V340H610V380H600V820Z') + P('M464 340L539 220L614 340Z');
      o += P('M352 820V690A48 48 0 0 1 448 690V820Z') + D('M400 644V820M352 730H448M352 780H448');
      o += P('M246 520V480A16 16 0 0 1 278 480V520Z') + P('M522 520V480A16 16 0 0 1 554 480V520Z') + C(400, 560, 26);
      o += D('M261 220V170') + P('M261 170H310L296 186L310 202H261Z') + D('M539 220V170') + P('M539 170H588L574 186L588 202H539Z');
      o += P('M0 820Q200 790 400 820T800 810V1100H0Z');
      for (i = 0; i < 3; i++) { var bx = 330 + i * 110, by = 250 + (i % 2) * 60; o += P('M' + bx + ' ' + by + 'Q' + (bx - 22) + ' ' + (by - 26) + ' ' + (bx - 46) + ' ' + by + 'Q' + (bx - 24) + ' ' + (by - 8) + ' ' + bx + ' ' + (by + 12) + 'Q' + (bx + 24) + ' ' + (by - 8) + ' ' + (bx + 46) + ' ' + by + 'Q' + (bx + 22) + ' ' + (by - 26) + ' ' + bx + ' ' + by + 'Z'); }
      return o;
    }
  };

  var EXTRA = {
    rocket: function () { return rocket(660, 560, .9, 20); },
    octopus: function () { return octopus(640, 420, .8); },
    chest: function () { return chest(630, 880, .9); },
    rainbow: function () { return rainbow(400, 700, 360, 30, 5); }
  };

  // ================= PAGINI =================
  var STYLE = '<style>svg .d{fill:none;pointer-events:none}svg .k{fill:#111;pointer-events:none}svg .w{fill:#fff;pointer-events:none}svg .n{stroke:none}' +
    'svg .t{font-family:"Arial Black","Arial Rounded MT Bold","Trebuchet MS",Verdana,sans-serif;font-weight:900;stroke-width:2.5}' +
    'svg .b{font-family:"Trebuchet MS",Verdana,Arial,sans-serif;font-weight:700;fill:#111;stroke:none;pointer-events:none}' +
    'svg .s{font-family:Verdana,Arial,sans-serif;fill:#777;stroke:none;pointer-events:none}</style>';

  function wrap(inner, footer) {
    var id = 'c' + (++uid);
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '">' + STYLE +
      '<rect width="' + W + '" height="' + H + '" fill="#fff"/>' +
      '<clipPath id="' + id + '"><rect x="20" y="20" width="760" height="1040" rx="26"/></clipPath>' +
      '<g stroke="#111" stroke-width="' + SW + '" stroke-linejoin="round" stroke-linecap="round" fill="#fff">' +
      '<g clip-path="url(#' + id + ')"><rect class="f" x="0" y="0" width="800" height="1100"/>' + inner + '</g>' +
      '<rect class="d" x="20" y="20" width="760" height="1040" rx="26" stroke-width="6"/></g>' +
      '<text class="s" x="400" y="1086" font-size="15" text-anchor="middle">' + esc(footer || 'Liga Creioanelor') + '</text></svg>';
  }
  function banner(title) {
    var t = title.toUpperCase(), fs = Math.min(46, 880 / Math.max(8, t.length));
    return RC(80, 962, 640, 80, 22) + txt(t, 400, 1002 + fs * .36, fs);
  }
  function castLayout(list) {
    var n = list.length, sc = n === 1 ? 1.32 : n === 2 ? 0.98 : 0.8, xs = n === 1 ? [400] : n === 2 ? [255, 545] : [165, 400, 635], o = '';
    list.forEach(function (c, i) {
      var parts = c.split(':'), id = parts[0], pose = parts[1] || 'stand', p = POSES[pose] || {}, flip = parts[2] === 'f';
      var small = id === 'pat' ? .85 : 1, s = sc * small;
      var y = 925 - 178 * s + (p.dy || 0) * sc;
      o += place(xs[i], y, s, figure(id, pose, i * 7 + id.length + n), p.rot || 0, flip);
    });
    return o;
  }
  function page(spec, lang, footer) {
    var r = rng(spec.seed || 1), o = SCENES[spec.scene](r);
    (spec.extra || []).forEach(function (e) {
      if (e.indexOf('pow:') === 0) { var w = e.slice(4).split('|'); o += burst(w[2] ? +w[2] : 170, w[3] ? +w[3] : 330, w[lang === 'en' && w[1] ? 1 : 0]); }
      else if (EXTRA[e]) o += EXTRA[e]();
    });
    o += castLayout(spec.cast) + banner(spec.t[lang === 'en' ? 1 : 0]);
    return wrap(o, footer);
  }

  // --- benzi desenate
  function bubble(x, y, w, lines) {
    var h = 26 + lines.length * 25, x1 = x + w * .2, x2 = x + w * .38, b = y + h, r = x + w;
    var o = P('M' + f(x + 22) + ' ' + y + 'H' + f(r - 22) + 'Q' + f(r) + ' ' + y + ' ' + f(r) + ' ' + (y + 22) + 'V' + (b - 22) + 'Q' + f(r) + ' ' + b + ' ' + f(r - 22) + ' ' + b +
      'H' + f(x2) + 'L' + f(x1 - 26) + ' ' + (b + 40) + 'L' + f(x1) + ' ' + b + 'H' + f(x + 22) + 'Q' + f(x) + ' ' + b + ' ' + f(x) + ' ' + (b - 22) + 'V' + (y + 22) + 'Q' + f(x) + ' ' + y + ' ' + f(x + 22) + ' ' + y + 'Z');
    lines.forEach(function (l, i) { o += txt(l, x + w / 2, y + 36 + i * 25, 19, 'b'); });
    return o;
  }
  function lines(s, max) {
    var out = [], cur = '';
    s.split(' ').forEach(function (w) { if ((cur + ' ' + w).trim().length > max) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
    if (cur) out.push(cur); return out;
  }
  function panel(px, py, pw, ph, pn, lang, seed) {
    var s = pw / 760, y0 = 880 - ph / s, r = rng(seed);
    var inner = G('translate(' + f(px - 20 * s) + ' ' + f(py - y0 * s) + ') scale(' + f(s) + ')', SCENES[pn.scene](r), 'stroke-width="' + f(3.6 / s) + '"');
    var wide = pw > 500, hs = wide ? .56 : .46, n = pn.cast.length;
    pn.cast.forEach(function (c, i) {
      var parts = c.split(':'), id = parts[0], pose = parts[1] || 'stand', p = POSES[pose] || {};
      var small = id === 'pat' ? .62 : id === 'mat' ? .8 : id === 'pix' ? .92 : 1, sc = hs * small;
      var x = wide ? px + 150 + i * 190 : px + (n === 1 ? 110 : 90 + i * 130);
      inner += place(x, py + ph - 14 - 178 * sc + (p.dy || 0) * hs * .5, sc, figure(id, pose, seed + i), p.rot ? p.rot * .6 : 0, parts[2] === 'f');
    });
    var ls = lines(pn.say[lang === 'en' ? 1 : 0], wide ? 24 : 15), bw = wide ? 330 : 196;
    var bx = wide ? px + pw - bw - 24 : px + pw - bw - 12;
    inner += bubble(bx, py + 14, bw, ls);
    return clip('<rect x="' + px + '" y="' + py + '" width="' + pw + '" height="' + ph + '" rx="14"/>', RC(px, py, pw, ph, 0) + inner) +
      '<rect class="d" x="' + px + '" y="' + py + '" width="' + pw + '" height="' + ph + '" rx="14" stroke-width="5"/>';
  }
  function comic(spec, lang, footer) {
    var en = lang === 'en', t = spec.t[en ? 1 : 0].toUpperCase();
    var o = txt(t, 400, 78, Math.min(40, 840 / Math.max(8, t.length)));
    o += panel(36, 100, 728, 330, spec.panels[0], lang, spec.seed);
    o += panel(36, 444, 357, 290, spec.panels[1], lang, spec.seed + 1);
    o += panel(407, 444, 357, 290, spec.panels[2], lang, spec.seed + 2);
    o += RC(36, 748, 728, 296, 14) + txt(en ? 'Draw what happens next!' : 'Desenează tu ce urmează!', 400, 786, 20, 'b');
    return wrap(o, footer);
  }

  // --- Fabrica de eroi: un erou nou din orice număr
  var GEN = {
    a: [['Căpitan', 'Captain'], ['Super', 'Super'], ['Mega', 'Mega'], ['Doamna', 'Lady'], ['Micul', 'Little'], ['Turbo', 'Turbo'], ['Ultra', 'Ultra'], ['Agent', 'Agent']],
    b: [['Fulger', 'Flash'], ['Nor', 'Cloud'], ['Stea', 'Star'], ['Vulcan', 'Volcano'], ['Bujor', 'Blossom'], ['Ghețar', 'Glacier'], ['Cometă', 'Comet'], ['Val', 'Tide'], ['Licurici', 'Firefly'], ['Vânt', 'Gale'], ['Ecou', 'Echo'], ['Curcubeu', 'Prism']]
  };
  function genSpec(seed) {
    var r = rng(seed * 7919 + 13), pick = function (a) { return a[Math.floor(r() * a.length)]; };
    var a = pick(GEN.a), b = pick(GEN.b);
    var h = { hair: pick(['spiky', 'bob', 'pony', 'curly', 'mohawk', 'helmet', 'buns', 'none']), mask: pick(['domino', 'domino', 'goggles', 'visor', 'cowl', 'none']), emblem: pick(['star', 'bolt', 'drop', 'leaf', 'flame', 'moon', 'heart', 'sun']), cape: r() < .7, skirt: r() < .3, big: r() < .2, face: pick(['smile', 'open', 'smirk']) };
    if (h.mask === 'cowl') h.hair = 'none';
    return { h: h, t: [a[0] + ' ' + b[0], a[1] + ' ' + b[1]], pose: pick(['hero', 'power', 'wave', 'fly', 'jump', 'point', 'stand']), scene: pick(['spot', 'city', 'space', 'sea', 'forest', 'sky']), seed: seed };
  }
  function genPage(seed, lang, footer) {
    var g = genSpec(seed), p = POSES[g.pose], r = rng(seed), s = 1.22;
    var o = SCENES[g.scene](r) + place(400, 925 - 178 * s + (p.dy || 0) * s, s, hero(g.h, g.pose), p.rot || 0) + banner(g.t[lang === 'en' ? 1 : 0]);
    return { svg: wrap(o, footer), title: g.t[lang === 'en' ? 1 : 0] };
  }

  // ================= CATALOG =================
  function S(scene, list) {
    return list.map(function (a, i) { return { t: [a[0], a[1]], scene: a[3] || scene, cast: a[2].split(' '), extra: a[4] || [], seed: (scene.length * 131 + i * 17 + 3) }; });
  }
  var SERIES = [
    { id: 'liga', free: true, t: ['Liga se prezintă', 'Meet the League'], d: ['Toți eroii, unul câte unul.', 'Every hero, one by one.'],
      pages: S('spot', ['cur:hero', 'ful:wave', 'tun:power', 'und:hero', 'fru:wave', 'sca:power', 'lun:hero', 'nor:wave', 'pix', 'mat', 'bar:point'].map(function (c) { var n = CAST[c.split(':')[0]].n; return [n[0], n[1], c]; }).concat([['Petele Baronului', 'The Baron\'s Blots', 'pat pat pat']])) },
    { id: 'oras', t: ['Orașul fără culori', 'The City Without Colors'], d: ['Baronul Gri a furat culorile orașului.', 'Baron Grey stole the city\'s colors.'],
      pages: S('city', [
        ['Alarmă în oraș!', 'City Alert!', 'cur:point'],
        ['Fulgerica aleargă', 'Zippy on the Run', 'ful:run', 0, ['pow:ZVÂC!|ZOOM!']],
        ['Zbor peste blocuri', 'Over the Rooftops', 'cur:fly'],
        ['Tunet e gata', 'Thunder Is Ready', 'tun:power'],
        ['Echipa de noapte', 'The Night Team', 'lun:hero mat'],
        ['Pix repară orașul', 'Pix Fixes the City', 'pix', 0, ['pow:BIP!|BEEP!']],
        ['Petele au scăpat!', 'The Blots Escaped!', 'pat pat pat'],
        ['Scânteia aprinde luminile', 'Sparky Lights Up', 'sca:power'],
        ['Prinde-o!', 'Catch It!', 'ful:run pat'],
        ['Salut, cetățeni!', 'Hello, Citizens!', 'und:wave nor:wave'],
        ['Împreună suntem tari', 'Stronger Together', 'cur:hero tun:hero ful:hero'],
        ['Orașul e din nou colorat', 'The City Shines Again', 'fru:jump sca:jump', 'sky']
      ]) },
    { id: 'spatiu', t: ['Misiune în spațiu', 'Space Mission'], d: ['Petele au fugit printre stele.', 'The Blots ran off to the stars.'],
      pages: S('space', [
        ['Decolare!', 'Lift-off!', 'nor:hero', 0, ['rocket']],
        ['Căpitanul printre stele', 'Captain Among the Stars', 'cur:fly'],
        ['Pix pe Lună', 'Pix on the Moon', 'pix'],
        ['Luna și stelele', 'Moonlight and the Stars', 'lun:power'],
        ['Întâlnire cu OZN-ul', 'UFO Encounter', 'ful:point'],
        ['Tunet mută o planetă', 'Thunder Moves a Planet', 'tun:power'],
        ['Pete spațiale', 'Space Blots', 'pat pat'],
        ['Salt pe Lună', 'Moon Jump', 'sca:jump und:jump'],
        ['Motanul astronaut', 'Astro Kitty', 'mat', 0, ['rocket']],
        ['Cursa cometelor', 'Comet Race', 'ful:fly'],
        ['Baronul fură stelele', 'The Baron Steals the Stars', 'bar:hero'],
        ['Stelele sunt salvate', 'The Stars Are Saved', 'cur:power nor:power']
      ]) },
    { id: 'mare', t: ['Eroii adâncurilor', 'Heroes of the Deep'], d: ['O misiune sub valuri.', 'A mission beneath the waves.'],
      pages: S('sea', [
        ['Unda sub valuri', 'Wave Girl Dives In', 'und:fly'],
        ['Prietenii pești', 'Fishy Friends', 'nor:wave'],
        ['Comoara scufundată', 'The Sunken Treasure', 'cur:point', 0, ['chest']],
        ['Pix, submarinul', 'Pix the Submarine', 'pix'],
        ['Tunet și caracatița', 'Thunder and the Octopus', 'tun:hero', 0, ['octopus']],
        ['Dans cu bulele', 'Bubble Dance', 'sca:jump'],
        ['Pete ude', 'Soggy Blots', 'pat pat pat'],
        ['Înot în echipă', 'Team Swim', 'und:jump ful:jump'],
        ['Frunză și algele', 'Leafy and the Seaweed', 'fru:wave'],
        ['Motanul nu vrea apă', 'Kitty Hates Water', 'mat', 0, ['pow:MIAU!|MEOW!']],
        ['Luna din adâncuri', 'Moonlight Below', 'lun:hero', 0, ['octopus']],
        ['Marea e din nou albastră', 'The Sea Is Blue Again', 'und:power cur:power']
      ]) },
    { id: 'padure', t: ['Pădurea Curcubeu', 'Rainbow Forest'], d: ['Eroii apără copacii și florile.', 'The heroes protect the trees and flowers.'],
      pages: S('forest', [
        ['Frunză, paznicul pădurii', 'Leafy, Forest Guardian', 'fru:hero'],
        ['Picnic de supereroi', 'Superhero Picnic', 'nor:wave mat'],
        ['Ciuperci uriașe', 'Giant Mushrooms', 'ful:point'],
        ['Tunet plantează un copac', 'Thunder Plants a Tree', 'tun:stand'],
        ['Zbor printre copaci', 'Flying Through the Trees', 'cur:fly'],
        ['Flori pentru toți', 'Flowers for Everyone', 'sca:wave und:wave'],
        ['Petele se ascund', 'The Blots Are Hiding', 'pat pat'],
        ['Pix numără florile', 'Pix Counts the Flowers', 'pix'],
        ['Apare curcubeul', 'The Rainbow Appears', 'fru:power', 'sky'],
        ['Seara în pădure', 'Evening in the Forest', 'lun:stand mat'],
        ['Cursa prin poiană', 'Meadow Race', 'ful:run nor:run'],
        ['Pădurea e salvată', 'The Forest Is Saved', 'fru:jump cur:jump tun:jump']
      ]) },
    { id: 'castel', t: ['Castelul Baronului Gri', 'Baron Grey\'s Castle'], d: ['Marea confruntare.', 'The big showdown.'],
      pages: S('lair', [
        ['Castelul cenușiu', 'The Grey Castle', 'bar:stand'],
        ['Planul cel rău', 'The Evil Plan', 'bar:point pat'],
        ['Liga sosește', 'The League Arrives', 'cur:hero lun:hero'],
        ['Paznicii castelului', 'Castle Guards', 'pat pat pat'],
        ['Tunet sparge poarta', 'Thunder Breaks the Gate', 'tun:power', 0, ['pow:BUM!|BOOM!']],
        ['Prea rapidă!', 'Too Fast to Catch', 'ful:run', 0, ['pow:ZUUM!|ZOOM!']],
        ['Duelul', 'The Duel', 'cur:point bar:point:f'],
        ['Scânteia luminează drumul', 'Sparky Lights the Way', 'sca:power'],
        ['Pix deschide seiful', 'Pix Cracks the Safe', 'pix', 0, ['pow:CLIC!|CLICK!']],
        ['Culorile sunt libere!', 'The Colors Are Free!', 'nor:jump und:jump', 'sky'],
        ['Baronul învață să coloreze', 'The Baron Learns to Color', 'bar:wave', 'sky'],
        ['Petrecere la castel', 'Castle Party', 'cur:wave bar:wave fru:wave']
      ]) },
    { id: 'banda', comic: true, t: ['Bandă desenată: Ziua fără culori', 'Comic: The Day Without Colors'], d: ['Povestea întreagă, în 8 pagini.', 'The whole story in 8 pages.'],
      pages: [
        ['Ziua fără culori', 'The Day Without Colors', ['city', 'cur:stand', 'Ce dimineață frumoasă în oraș!', 'What a lovely morning in the city!'], ['city', 'bar:point', 'Ha-ha! Iau toate culorile!', 'Ha-ha! I am taking all the colors!'], ['city', 'pat pat', 'Gri! Gri! Gri!', 'Grey! Grey! Grey!']],
        ['Chemați Liga!', 'Call the League!', ['city', 'cur:point', 'Orașul e cenușiu! Chemați Liga Creioanelor!', 'The city is grey! Call the Crayon League!'], ['city', 'ful:run', 'Vin într-o clipă!', 'On my way!'], ['city', 'tun:power', 'Sunt gata!', 'I am ready!']],
        ['Urmărirea', 'The Chase', ['sky', 'cur:fly und:hero', 'După el! Nu-l lăsați să scape!', 'After him! Do not let him get away!'], ['sky', 'nor:wave', 'Vă urmez!', 'Right behind you!'], ['lair', 'bar:stand', 'Nu mă veți prinde niciodată!', 'You will never catch me!']],
        ['Petele din pădure', 'Blots in the Forest', ['forest', 'fru:hero', 'Petele s-au ascuns în pădurea mea.', 'The Blots are hiding in my forest.'], ['forest', 'pat', 'Ups... ne-au găsit!', 'Oops... they found us!'], ['forest', 'mat', 'Miau! Le-am prins!', 'Meow! Got them!']],
        ['Până la stele', 'To the Stars', ['space', 'nor:hero pix', 'Unele au fugit în spațiu. Pix, le aduci înapoi?', 'Some escaped to space. Pix, can you bring them back?'], ['space', 'pix', 'Bip-bop! Imediat!', 'Beep-bop! Right away!'], ['space', 'pat', 'Aici e prea frig!', 'It is too cold here!']],
        ['La castel', 'At the Castle', ['lair', 'lun:hero cur:stand', 'Castelul Baronului e chiar acolo.', 'The Baron\'s castle is right there.'], ['lair', 'tun:power', 'BUM! Poarta e deschisă.', 'BOOM! The gate is open.'], ['lair', 'bar:stand', 'Oh, nu! Liga!', 'Oh no! The League!']],
        ['Secretul Baronului', 'The Baron\'s Secret', ['lair', 'cur:point bar:stand:f', 'Dă-ne culorile înapoi, Baroane!', 'Give the colors back, Baron!'], ['lair', 'bar:stand', 'Eu... n-am știut niciodată să colorez.', 'I... never learned how to color.'], ['lair', 'sca:wave', 'Te învățăm noi! E ușor.', 'We will teach you! It is easy.']],
        ['Colorează tu lumea', 'You Color the World', ['sky', 'cur:wave bar:wave', 'Acum colorează TU lumea, împreună cu noi!', 'Now YOU color the world, together with us!'], ['sky', 'nor:power', 'Fiecare culoare e o superputere.', 'Every color is a superpower.'], ['sky', 'mat', 'Sfârșit... sau abia începutul?', 'The end... or just the beginning?']]
      ].map(function (a, i) {
        return { t: [a[0], a[1]], seed: 500 + i * 10, panels: a.slice(2).map(function (p) { return { scene: p[0], cast: p[1].split(' '), say: [p[2], p[3]] }; }) };
      }) }
  ];

  function render(sid, idx, lang) {
    var s = SERIES.filter(function (x) { return x.id === sid; })[0], p = s.pages[idx];
    var footer = 'Liga Creioanelor · ' + s.t[lang === 'en' ? 1 : 0] + ' · ' + (idx + 1) + '/' + s.pages.length;
    return s.comic ? comic(p, lang, footer) : page(p, lang, footer);
  }

  var api = { W: W, H: H, SERIES: SERIES, CAST: CAST, render: render, genPage: genPage };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.LigaArt = api;
})(typeof self !== 'undefined' ? self : this);
