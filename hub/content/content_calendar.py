"""
Generator de calendar de conținut pentru toate brandurile din hub/brands.json, cu Claude.

Produce, per brand, un CSV gata de importat în Postiz (self-hosted, gratuit) / Buffer / Metricool,
plus un JSON cu scripturile complete (hook, voice-over, subtitrări, prompt de b-roll).

  pip install anthropic pydantic
  export ANTHROPIC_API_KEY=...        # sau `ant auth login`
  python hub/content/content_calendar.py --brand pbn --days 14
  python hub/content/content_calendar.py --all --days 7

Regulă: tot ce iese de aici e DRAFT. Un om aprobă înainte de publicare (vezi ops/README.md).
"""
from __future__ import annotations

import argparse
import csv
import json
from datetime import date, timedelta
from pathlib import Path
from typing import List, Literal

import anthropic
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parents[2]
MODEL = "claude-opus-5-5"


class Post(BaseModel):
    day: int                       # 1..N
    platform: Literal["instagram", "tiktok", "facebook", "pinterest", "linkedin", "youtube_shorts"]
    format: Literal["reel", "carousel", "story", "short", "text_post", "pin"]
    pillar: str
    hook: str                      # primele 3 secunde / primul rând
    script: str                    # voice-over sau textul complet
    on_screen_text: List[str]      # subtitrări scurte, în ordine
    broll_prompt: str              # ce filmăm sau ce generăm (descriere pentru editor / AI video)
    caption: str
    hashtags: List[str]
    cta: str


class Calendar(BaseModel):
    brand: str
    posts: List[Post]


SYSTEM = """Ești strategul de conținut al unui portofoliu de mici afaceri din România.
Scrii în română naturală (nu traducere), adaptat fiecărei platforme.
Reguli ferme:
- Respectă politicile Instagram/TikTok/YouTube: fără nuditate, fără conținut sexual explicit,
  fără promisiuni de câștig financiar, fără afirmații medicale.
- Conținutul generat sau modificat cu AI (fețe, voci) se marchează ca atare în caption ("#AI").
- Fiecare postare are o singură idee și un singur CTA.
- Hook-ul trebuie să funcționeze fără sunet."""


def generate(client: anthropic.Anthropic, brand_key: str, brand: dict, days: int) -> Calendar:
    prompt = (f"Brand: {json.dumps(brand, ensure_ascii=False)}\n\n"
              f"Creează un calendar de {days} zile, 1-2 postări/zi, rotind pilonii și platformele "
              f"din listă. Câmpul brand = \"{brand_key}\".")
    resp = client.messages.parse(
        model=MODEL,
        max_tokens=16000,
        system=SYSTEM,
        output_config={"effort": "medium"},
        messages=[{"role": "user", "content": prompt}],
        output_format=Calendar,
    )
    if resp.stop_reason == "refusal":
        raise RuntimeError(f"{brand_key}: cererea a fost refuzată ({resp.stop_details})")
    if resp.stop_reason == "max_tokens":
        raise RuntimeError(f"{brand_key}: răspuns trunchiat — reduceți --days")
    return resp.parsed_output


def write_outputs(cal: Calendar, start: date, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / f"{cal.brand}-{start}.json").write_text(cal.model_dump_json(indent=2), encoding="utf-8")
    csv_path = out_dir / f"{cal.brand}-{start}.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["date", "time", "platform", "format", "text", "media_brief", "status"])
        for p in cal.posts:
            when = start + timedelta(days=p.day - 1)
            text = f"{p.hook}\n\n{p.caption}\n\n{p.cta}\n\n{' '.join('#' + h.lstrip('#') for h in p.hashtags)}"
            # ore de vârf RO: 12:30 și 19:30 — ajustați după Insights
            w.writerow([when.isoformat(), "19:30" if p.format in ("reel", "short") else "12:30",
                        p.platform, p.format, text, p.broll_prompt, "draft"])
    return csv_path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--brand")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--start", default=str(date.today() + timedelta(days=1)))
    ap.add_argument("--out", default=str(ROOT / "hub" / "content" / "out"))
    a = ap.parse_args()

    brands = json.loads((ROOT / "hub" / "brands.json").read_text(encoding="utf-8"))["brands"]
    keys = list(brands) if a.all else [a.brand]
    if not keys or keys == [None] or any(k not in brands for k in keys):
        ap.error(f"--brand trebuie să fie unul din: {', '.join(brands)} (sau --all)")

    client = anthropic.Anthropic()
    for k in keys:
        cal = generate(client, k, brands[k], a.days)
        path = write_outputs(cal, date.fromisoformat(a.start), Path(a.out))
        print(f"✓ {k}: {len(cal.posts)} postări -> {path}")


if __name__ == "__main__":
    main()
