"""
Self-checkup pentru tot portofoliul: verifică fiecare site/API din hub/brands.json și din ops/targets.json.

Ce verifică:
  - HTTP status 200 și timp de răspuns (< 3 s)
  - certificat TLS care expiră în < 14 zile
  - endpoint-ul /health al API-ului PBN (DB + adâncimea cozii; alertă dacă > 500 joburi)
Rulează automat din .github/workflows/healthcheck.yml (la fiecare oră) și deschide un issue dacă pică ceva.
Local: python ops/healthcheck.py   (exit code 1 dacă există probleme)
"""
from __future__ import annotations

import json
import socket
import ssl
import sys
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]


def targets() -> list[dict]:
    out = []
    brands = json.loads((ROOT / "hub/brands.json").read_text(encoding="utf-8"))["brands"]
    for k, b in brands.items():
        for field in ("site", "health_url"):
            if b.get(field):
                out.append({"name": f"{k}:{field}", "url": b[field]})
    extra = ROOT / "ops/targets.json"
    if extra.exists():
        out += json.loads(extra.read_text(encoding="utf-8"))
    return out


def check_http(url: str) -> tuple[bool, str]:
    t0 = time.monotonic()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "portfolio-healthcheck/1.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            body = r.read(200_000)
            dt = time.monotonic() - t0
            if r.status != 200:
                return False, f"HTTP {r.status}"
            msg = f"200 în {dt:.2f}s"
            if url.rstrip("/").endswith("/health"):
                data = json.loads(body)
                if not data.get("ok"):
                    return False, f"/health ok=false: {data}"
                if data.get("queueDepth", 0) > 500:
                    return False, f"coada PBN e prea mare: {data['queueDepth']} joburi (adăugați workeri)"
                msg += f", coadă={data.get('queueDepth')}"
            return dt < 3, msg + ("" if dt < 3 else " (lent!)")
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"


def check_tls(url: str) -> tuple[bool, str]:
    host = urlparse(url).hostname
    if urlparse(url).scheme != "https" or not host:
        return True, "fără TLS"
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((host, 443), timeout=10) as s, ctx.wrap_socket(s, server_hostname=host) as ss:
            exp = datetime.strptime(ss.getpeercert()["notAfter"], "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
        days = (exp - datetime.now(timezone.utc)).days
        return days >= 14, f"certificat expiră în {days} zile"
    except Exception as e:
        return False, f"TLS: {e}"


def main() -> int:
    ts = targets()
    if not ts:
        print("Nicio țintă configurată (completați `site`/`health_url` în hub/brands.json).")
        return 0
    failed = []
    for t in ts:
        for check in (check_http, check_tls):
            ok, msg = check(t["url"])
            print(f"{'✅' if ok else '❌'} {t['name']:<22} {check.__name__:<10} {msg}")
            if not ok:
                failed.append(f"- **{t['name']}** ({t['url']}): {msg}")
    if failed:
        Path(ROOT / "ops/last-failures.md").write_text("\n".join(failed) + "\n", encoding="utf-8")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
