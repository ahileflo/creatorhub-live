"""
Worker Python care consumă joburi de procesare din Redis (coada `pbn:jobs`), publicate de API-ul Node.

De ce nu BullMQ direct în Python: BullMQ are client Python (`pip install bullmq`) — îl puteți folosi;
aici folosim un contract minimal și explicit (LIST + BRPOP + status în Postgres) ca să nu depindem de
formatul intern BullMQ. API-ul Node publică JSON: {"job_id","order_id","source_key","n_colors","width_cm","height_cm"}.

Rulare: REDIS_URL=redis://... DATABASE_URL=postgres://... python -m pbn.engine.worker
Scalare: rulați N replici (Kubernetes/ECS/Fly Machines) — BRPOP garantează că un job e luat o singură dată.
"""
from __future__ import annotations

import json
import os
import tempfile
import traceback
from datetime import datetime, timezone
from pathlib import Path

from .pbn import PBNConfig, process
from .storage import get_storage

QUEUE = "pbn:jobs"


def _db():
    import psycopg  # pip install "psycopg[binary]"
    return psycopg.connect(os.environ["DATABASE_URL"], autocommit=True)


def _download(source_key: str, dst: Path) -> None:
    if os.getenv("STORAGE_BACKEND", "local") == "s3":
        import boto3
        boto3.client("s3", endpoint_url=os.getenv("S3_ENDPOINT_URL")).download_file(os.environ["S3_BUCKET"], source_key, str(dst))
    else:
        dst.write_bytes((Path(os.getenv("LOCAL_STORAGE_DIR", "storage")) / source_key).read_bytes())


def handle(job: dict, db) -> None:
    now = datetime.now(timezone.utc)
    db.execute("UPDATE processing_jobs SET status='processing', started_at=now(), attempts=attempts+1 WHERE id=%s", (job["job_id"],))
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "src"
        _download(job["source_key"], src)
        cfg = PBNConfig(n_colors=job.get("n_colors", 24), canvas_width_cm=job.get("width_cm", 40),
                        canvas_height_cm=job.get("height_cm", 50))
        res = process(src, Path(tmp) / "out", cfg)
        prefix = f"orders/{now:%Y/%m}/{job['order_id']}/job-{job['job_id']}"
        files = get_storage().put_dir(Path(tmp) / "out", prefix)
    db.execute(
        "UPDATE processing_jobs SET status='done', finished_at=now(), output_prefix=%s, result=%s WHERE id=%s",
        (prefix, json.dumps({"files": files, **res.to_json()}), job["job_id"]))


def main():
    import redis  # pip install redis
    r = redis.from_url(os.environ["REDIS_URL"])
    db = _db()
    print("worker pornit, aștept joburi…")
    while True:
        _, raw = r.brpop(QUEUE)
        job = json.loads(raw)
        try:
            handle(job, db)
        except Exception as e:
            traceback.print_exc()
            row = db.execute("UPDATE processing_jobs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END, "
                             "error=%s WHERE id=%s RETURNING status", (str(e)[:2000], job["job_id"])).fetchone()
            if row and row[0] == "queued":
                r.lpush(QUEUE, raw)  # reîncercare


if __name__ == "__main__":
    main()
