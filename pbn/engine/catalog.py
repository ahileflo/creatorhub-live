"""
MODUL 1 — Generator automat de catalog (sute de modele) din Pexels.

De ce Pexels și nu Unsplash: licența Unsplash interzice explicit „compilarea fotografiilor
pentru a replica un serviciu similar/concurent” și vânzarea fotografiilor nemodificate; un kit
PBN e o lucrare derivată (OK la ambele), dar Pexels are API mai permisiv pentru volum.
ORICUM: evitați fotografii cu persoane identificabile, branduri, logo-uri, opere de artă sau
clădiri protejate — licența de stoc NU acoperă model/property release pentru produse fizice.
De aceea filtrul implicit exclude categoria "portret" din surse de stoc; portretele vin doar
de la clienți (Premium) sau din imagini generate AI pentru care aveți drepturi.

Folosire:
  export PEXELS_API_KEY=...
  python -m pbn.engine.catalog --per-category 40 --colors 24 36
"""
from __future__ import annotations

import argparse
import json
import os
import tempfile
import urllib.parse
import urllib.request
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

from .pbn import PBNConfig, process
from .storage import get_storage

ENGINE_VERSION = "1"
PEXELS = "https://api.pexels.com/v1/search"

CATEGORIES = {
    "peisaje": ["mountain lake", "autumn forest", "lavender field", "seaside sunset", "alpine village"],
    "flori": ["sunflowers", "peonies bouquet", "tulip field", "cherry blossom"],
    "animale": ["fox in snow", "horse meadow", "cat portrait", "dog golden retriever", "owl"],
    "orase": ["venice canal", "paris street night", "santorini", "old town street"],
    "obiecte": ["still life fruit", "coffee cup", "vintage bicycle", "sailboat"],
    "abstract": ["watercolor abstract", "geometric colorful"],
}


def pexels_search(query: str, per_page: int, page: int = 1) -> list[dict]:
    key = os.environ["PEXELS_API_KEY"]
    url = f"{PEXELS}?{urllib.parse.urlencode({'query': query, 'per_page': per_page, 'page': page, 'orientation': 'portrait'})}"
    req = urllib.request.Request(url, headers={"Authorization": key, "User-Agent": "pbn-catalog/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)["photos"]


def _job(photo: dict, category: str, color_sets: list[int]) -> dict:
    """Rulează într-un proces separat: descarcă, procesează pentru fiecare număr de culori, urcă."""
    storage = get_storage()
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "src.jpg"
        req = urllib.request.Request(photo["src"]["large2x"], headers={"User-Agent": "pbn-catalog/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            src.write_bytes(r.read())
        variants = {}
        for n in color_sets:
            out = Path(tmp) / f"c{n}"
            res = process(src, out, PBNConfig(n_colors=n, canvas_width_cm=40, canvas_height_cm=50))
            prefix = f"catalog/{category}/pexels-{photo['id']}/v{ENGINE_VERSION}/c{n}"
            variants[n] = {"files": storage.put_dir(out, prefix), "regions": res.n_regions,
                           "colors": res.n_colors, "paint_ml": round(sum(p.paint_ml for p in res.palette), 1)}
    return {
        "sku": f"PBN-{category[:3].upper()}-{photo['id']}",
        "category": category,
        "title": photo.get("alt") or f"{category} #{photo['id']}",
        "source": {"provider": "pexels", "id": photo["id"], "url": photo["url"],
                   "photographer": photo["photographer"], "photographer_url": photo["photographer_url"],
                   "license": "https://www.pexels.com/license/"},
        "variants": variants,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


def build_catalog(per_category: int, color_sets: list[int], workers: int, out_manifest: Path) -> list[dict]:
    seen, tasks, items = set(), [], []
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for cat, queries in CATEGORIES.items():
            per_q = max(1, per_category // len(queries))
            for q in queries:
                for p in pexels_search(q, per_q):
                    if p["id"] in seen:
                        continue
                    seen.add(p["id"])
                    tasks.append(pool.submit(_job, p, cat, color_sets))
        for fut in as_completed(tasks):
            try:
                items.append(fut.result())
                print("✓", items[-1]["sku"])
            except Exception as e:  # o poză stricată nu oprește tot catalogul
                print("✗", e)
    out_manifest.write_text(json.dumps(items, indent=2, ensure_ascii=False), encoding="utf-8")
    return items


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-category", type=int, default=40)
    ap.add_argument("--colors", type=int, nargs="+", default=[24, 36])
    ap.add_argument("--workers", type=int, default=os.cpu_count() or 2)
    ap.add_argument("--manifest", default="catalog.json")
    a = ap.parse_args()
    items = build_catalog(a.per_category, a.colors, a.workers, Path(a.manifest))
    print(f"Catalog: {len(items)} modele -> {a.manifest}")
