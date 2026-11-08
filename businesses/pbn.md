# Tablou din Poza Ta: kituri pictură pe numere (afacerea principală)

Este afacerea principală pentru că are cea mai mare marjă, cererea de cadouri e recurentă (Crăciun, Ziua Mamei, 8 Martie, aniversări), iar produsul poate fi automatizat cap-coadă. Codul e în [`pbn/`](../pbn/README.md).

## Ofertă și preț

| Pachet | Ce primește clientul | Preț | Cost estimat* | Marjă brută |
|---|---|---|---|---|
| **Catalog** | Model din catalog, 24 culori, 40×50, pânză rulată | 129 lei | ~35 lei | ~73% |
| **Standard** | Poza ta, 24/36 culori, 40×50, pânză rulată, previzualizare înainte de print | 189 lei | ~40 lei | ~79% |
| **Premium** ⭐ | Import direct Google Photos / iCloud, 36-48 culori, **pânză pe șasiu de lemn**, cupe de 5 ml, 4 pensule, cutie cadou + felicitare, 1 revizie gratuită a schiței | 289 lei | ~75 lei | ~74% |
| Add-on | Ramă, livrare express, al 2-lea kit -30% (cadou) | +49 / +25 / -30% | | |

\*Costuri estimate (pânză 380 g/m², vopsea acrilică, cupe, pensule, cutie, print). Livrarea se plătește separat sau e gratuită peste 250 lei. **Verificați-le cu ofertele reale ale furnizorilor.**

Ce face Premium să merite banii: clientul nu trebuie să caute poza, să o descarce și apoi să o urce. Dă click pe „Importă din Google Photos” sau, pe iPhone, alege direct din iCloud Photos.

## Producție: trei faze

1. **Validare (luna 1-2, ~500-1.500 €)**: software-ul din `pbn/` + print canvas la o tipografie locală, pe baza SVG/PDF + vopsele dozate manual (cântar 0,01 g, seringi) după `recipe.json`. Ținta: 30-50 de comenzi și feedback real despre calitate.
2. **Atelier (de la ~10 comenzi/zi)**: plotter de 24" (Epson SureColor P-series / Canon imagePROGRAF) + dozator semiautomat.
3. **Scalare**: fie paleta fixă de ~200 de culori cumpărată en-gros (fiecare culoare din K-Means se mapează la cea mai apropiată din paletă, vezi roadmap), fie dropshipping la o fabrică PBN care acceptă fișierele voastre prin API sau email.

**Furnizori de evaluat (cereți mostre înainte de orice volum):** pânză din bumbac 100% grunduită (Alibaba: „cotton canvas roll 380gsm”; local: distribuitori de media pentru print, ex. Antalis); vopsea acrilică fluidă non-toxică în bidoane de 1-5 L; cupe de 3/5 ml în benzi; pensule nylon cu mâner de lemn și logo; șasiuri de lemn de la tâmplării locale. Fabricile PBN cu dropshipping (Ningde/Yiwu) trebuie verificate personal: cereți mostră din **poza voastră**, termen de livrare în UE și condiții de retur.

## Drepturi și legal

- Catalogul folosește **Pexels** (lucrări derivate permise). Nu folosiți fotografii de stoc cu **persoane identificabile, logo-uri sau opere de artă**: licența nu include model release pentru produse fizice. `catalog.py` exclude din start portretele de stoc.
- Pozele clienților: clientul confirmă la comandă că deține drepturile. Originalul se **șterge automat după 30 de zile** (regulă S3 lifecycle) și se notează în `data_retention_log`. Informați despre asta în politica de confidențialitate (GDPR).
- Google Photos: aplicația OAuth trebuie verificată de Google înainte de lansare. Scope-ul Picker e restrâns, deci verificarea e simplă. Aveți nevoie de politică de confidențialitate publică și de domeniu verificat.
- Firmă: SRL micro sau PFA, facturare automată (SmartBill/Oblio prin API), politică de retur (produsele personalizate sunt exceptate de la dreptul de retragere de 14 zile, conform OUG 34/2014 art. 16 lit. c).

## Lansare (primele 30 de zile)

1. Generați catalogul: 200 de modele (`python -m pbn.engine.catalog --per-category 35`). Faceți QA manual și publicați primele 60.
2. Magazin: Shopify sau WooCommerce (sau Wix, pentru că plugin-ul e disponibil). Butonul Premium deschide `premium-import.html`, iar webhook-ul de plată creează comanda.
3. Conținut: `python hub/content/content_calendar.py --brand pbn --days 14`. Formatul care convertește cel mai bine e reel-ul „poza mea → tabloul pictat” cu timelapse.
4. Ads: Meta Advantage+ cu 30-50 lei/zi pe 3 creative înainte/după. Tăiați după 3 zile tot ce are CTR sub 1%.
5. Ofertă de cadou: „Comandă până pe 10 decembrie, livrare garantată de Crăciun.”

## Roadmap tehnic

- [ ] Maparea culorilor pe paleta fixă de vopsele (ΔE minim), ca să reduceți stocul la ~200 de culori
- [ ] Webhook Stripe/Netopia → `orders.status = awaiting_photo` → email cu linkul de import
- [ ] Email de previzualizare cu buton „Aprob” → `approved` → fișierul intră în folderul de print
- [ ] Generator de mockup-uri din PSD-uri reale (perete, cameră)
- [ ] Aplicație iOS (PHPicker) doar dacă datele arată mulți utilizatori iPhone care abandonează la upload
