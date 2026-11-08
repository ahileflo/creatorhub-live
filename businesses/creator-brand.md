# Brand creator: fitness, ASMR și lifestyle (persona anonimă)

Am păstrat conceptul (fitness/nutriție, estetica gym/festival/country, ASMR satisfying, healing, abonament + produse DIY), dar am schimbat **trei lucruri din promptul inițial** care ar fi distrus afacerea:

| Prompt inițial | De ce nu funcționează | Ce facem în schimb |
|---|---|---|
| Conținut senzual/erotic folosit ca lead magnet pe Instagram/TikTok, cu „jailbreak” ca să treacă de filtre | Conturile cu conținut sexual sugestiv primesc shadowban și apoi ban permanent, iar odată cu ele se pierde tot funnel-ul. Ocolirea moderării nu e o strategie, e o dată de expirare. | **Pâlnie în două niveluri**: pe rețelele publice doar conținut SFW (fitness, ASMR, estetică). Conținutul pentru adulți, dacă îl faceți, stă doar pe o platformă care îl permite explicit. |
| Face-swap profund ca să fiți „100% de nerecunoscut” și să evitați ban-urile | Platformele cer verificarea identității creatorului (KYC) și **etichetarea conținutului modificat cu AI**. Un face-swap nedeclarat încalcă regulile, iar dacă fața folosită e a unei persoane reale, e deepfake fără consimțământ (ilegal). | **Anonimat prin regie**: unghiuri fără față, măști și ochelari de festival, crop sub bărbie, cadre din spate și mâini. Dacă folosiți totuși o față AI, aceasta trebuie să fie **complet sintetică** (a nimănui), iar postarea e marcată #AI. |
| Programare masivă a postărilor ca să ascundeți locația | Nu ajută: locația scapă prin metadate și prin fundal. | **Igiena datelor**: ștergeți EXIF/GPS (comenzile sunt în secțiunea 2), fundaluri neutre, fără ferestre, plăcuțe de înmatriculare sau repere recognoscibile. |

## 1. Brand și psihologie

**Avatar A, „Andrei”, 24-38 de ani**: merge la sală sau vrea să înceapă, consumă ASMR ca să se relaxeze, e atras de estetica festival/outdoor. Cumpără din **aspirație** („vreau corpul și viața asta”) și din **curiozitate**.

**Avatar B, „Ioana”, 22-35 de ani**: glow-up, rutine de self-care, ASMR de organizare și curățenie, healing emoțional. Cumpără din **identitate** („așa vreau să arate viața mea”) și pentru **ritualuri**.

**Motorul de cumpărare**: tensiune estetică (frumos, puternic, încrezător) + valoare imediată (un exercițiu sau o rețetă pe care o aplici azi). Clipul gratuit trebuie să-l facă pe om să spună „wow, arată bine” **și** „ok, asta pot să fac și eu”. Al doilea gând e cel care transformă scroll-ul în cumpărare.

**Premium, nu ieftin**: paletă de culori constantă (bej/terracotta pentru country, neon/holografic pentru festival, negru/crom pentru gym), lumină naturală sau de studio, muzică lo-fi/house fără drepturi, zero text vulgar. Corpul e arătat ca rezultat al disciplinei, nu ca produs. Senzualitatea vine din încredere, mișcare și sunet, nu din expunere.

## 2. Stack tehnic

| Etapă | Unelte | Notă |
|---|---|---|
| Filmare | Telefon 4K + gimbal, lavalieră/mic binaural (pentru ASMR), softbox | ASMR-ul real (lemn, apă, pensule, organizare) bate orice efect AI |
| Anonimizare | Regie fără față + DaVinci Resolve (blur/track pe tatuaje, semne distinctive) | Etichetați orice față sintetică #AI |
| Voce | ElevenLabs Voice Changer / Voice Design: o voce sintetică stabilă pentru narațiune | Folosiți voci create pentru voi, nu clonele altor persoane |
| Editare / upscale | CapCut sau DaVinci (color grading), Topaz Video AI (upscale 4K) | Un preset de culoare per estetică |
| Subtitrări | CapCut auto-captions / Submagic | Același font peste tot (ex. Bebas Neue) |
| Programare | **Postiz** (self-hosted, gratuit) / Metricool / Later | CSV-urile din `hub/content/content_calendar.py --brand creator` se importă direct |
| Vânzare | Stan Store / Gumroad / Payhip (ghiduri), Skool sau Whop (abonament SFW) | Vezi secțiunea 4 pentru conținut adult |

**Protecția datelor** (rulați-o pe orice fișier înainte de upload):
```bash
exiftool -all= -overwrite_original fisier.jpg      # poze
ffmpeg -i in.mp4 -map_metadata -1 -c copy out.mp4  # video
```

## 3. Conținut și funnel

**Trei lead magnets virale (SFW, fără față):**
1. **„Lemn & lift”** (country): cadru de la spate, despicat lemne în outfit country/gym, sunet ASMR curat al toporului. Subtitrare: „Antrenamentul de spate pe care nu-l faci la sală 🪵” → 3 exerciții compuse. *Hook*: primul impact al toporului în secunda 0, fără intro.
2. **„Reset de duminică”** (ASMR organizare): mâini care organizează frigiderul cu meal-prep, sunete de capace și sticlă. Text: „5 prânzuri, 1.900 kcal, 45 de minute.” *Hook*: frigider haotic → plin și ordonat, în 2 secunde.
3. **„Festival body, 4 săptămâni”**: montaj cu lumini neon și ținută de festival filmată din unghiuri fără față, ritm house. Text: „Antrenamentul de 20 de minute care te ține în picioare 3 zile de festival.” *Hook*: drop-ul de bas sincronizat cu primul cadru.

**Tunelul**: Reel → comentariu cu un cuvânt („PLAN”) → DM automat (ManyChat) cu linkul → pagina „Plan 4 săptămâni”: ghid de 19$ + upsell abonament la checkout → email de bun venit (3 mesaje, ca în `businesses/copywriting.md`) → abonament.

## 4. Produse și abonament

**Produse de impuls (sub 29$):**
1. **„Festival Body: plan de 4 săptămâni”** (19$): PDF + video-uri fără față cu exercițiile, plan alimentar simplu, listă de cumpărături, playlist.
2. **„Reset Ritual: sistemul de duminică”** (24$): template Notion pentru organizare + meal-prep + rutine de self-care și jurnal (healing), plus 10 piste ASMR originale de 10 minute pentru somn/focus.

**Abonamentul „Inner Circle”, 12-15 $/lună (SFW, pe Skool/Whop/Patreon):**
- În fiecare săptămână: un antrenament nou, un meniu, un playlist și un ASMR lung exclusiv.
- O dată pe lună: live Q&A (fără față: voce + ecran) și un „drop” estetic (photoshoot festival/country).
- FOMO legitim: arhiva rămâne disponibilă doar cât timp ești abonat, cu prețul Founding blocat pe viață pentru primii 100.

**Dacă vreți și un nivel pentru adulți (18+):** acesta trebuie să stea pe o platformă care îl permite explicit și care face verificare de vârstă și identitate, de exemplu OnlyFans sau Fansly. Skool, Whop, Patreon și Fanfix **nu** permit conținut explicit. Pe aceste platforme amândoi trebuie să fiți verificați ca creatori, cu acordul scris al fiecăruia pentru conținutul comun, iar orice element generat sau modificat cu AI se etichetează conform regulilor platformei. Pe Instagram/TikTok se face trimitere doar către ofertele SFW. Veniturile se declară (PFA/SRL în România).

Pentru acest nivel nu vă ajut cu generarea de conținut sexual sau cu ocolirea moderării și a verificărilor platformelor. Vă ajut cu restul: brand, conținut SFW, produse, automatizări, site.
