# pbn_engine — motorul de procesare Paint-by-Numbers

Transformă orice fotografie în fișierele de producție ale unui kit „pictură pe numere":
contururi vectoriale numerotate (SVG/PDF), rețeta de vopsele (JSON) și imagini de previzualizare.
Arhitectura completă: [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

## Instalare

```bash
cd pbn-platform/processing
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# Pentru export PDF: biblioteca nativă Cairo (Debian/Ubuntu: apt-get install libcairo2)
```

## Utilizare — CLI

```bash
# 24 de culori, pânză 40×50 cm, decupare centrală
python -m pbn_engine poza.jpg -o out/ --colors 24

# 36 de culori, pânză 50×40 cm (landscape), încadrare cu margini albe, profil CMYK de tipar
python -m pbn_engine peisaj.jpg -o out/ -c 36 --size 500x400 --fit pad --icc ISOcoated_v2.icc
```

Valori acceptate pentru `--colors`: 12, 18, 24, 30, 36, 48, 60.

## Utilizare — din Python (worker)

```python
from pbn_engine import ProcessingConfig, PaintConfig, generate

cfg = ProcessingConfig(
    num_colors=36,
    canvas_width_mm=400, canvas_height_mm=500,
    min_region_mm2=8.0,                     # zona minimă pictabilă
    paint=PaintConfig(wet_film_mm=0.08, coats=2, waste_factor=0.2),
)
result = generate("poza.jpg", "/tmp/job-123", cfg, title="Apus la mare")
print(result.stats["num_regions"], result.recipe["total_paint_ml"])
```

## Fișiere generate

| Fișier | Conținut |
|---|---|
| `canvas.svg`, `canvas.pdf` | Fișierul de print: contururi gri + numere, dimensiune fizică în mm |
| `solution.svg` | Aceleași regiuni, colorate (control calitate) |
| `recipe.json` | Pentru fiecare număr: HEX, RGB, LAB, CMYK, arie (cm², %), straturi, ml estimați, recipient |
| `manifest.json` | Versiune motor, hash sursă, nr. regiuni, dificultate, timpi, configurația completă |
| `painted.png`, `numbered.png`, `palette.png`, `mockup.jpg` | Previzualizări pentru magazin |

Exemplu de intrare din `recipe.json`:

```json
{
  "number": 7, "hex": "#C8643C", "rgb": [200, 100, 60], "cmyk": [0.0, 50.0, 70.0, 21.6],
  "area_cm2": 112.4, "coverage_pct": 5.62, "regions": 41,
  "coats": 2, "paint_ml": 2.16, "pot_ml": 3.0
}
```

## Teste

```bash
python -m pytest -q
```
