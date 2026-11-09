"""
Worker-ul de procesare (Python, CPU-bound) — consumă cozile BullMQ
`pbn-orders` și `pbn-catalog` produse de API-ul Node.js.

Contractul cu API-ul:
  - mesajul din coadă conține doar {"jobId": "<uuid>"};
  - parametrii, sursa și prefixul de ieșire se citesc din `processing_jobs`;
  - rezultatul se scrie în `job_artifacts`, `paint_recipes` și `processing_jobs`.

Garanții:
  - idempotent: un job deja 'succeeded' nu se reprocesează (mesaj duplicat / reaper);
  - heartbeat în DB la 30 s, ca reaper-ul API să detecteze workerii morți;
  - `manifest.json` se urcă ULTIMUL (marker de completitudine), apoi tranzacția DB;
  - pbn_engine rulează într-un thread, ca bucla asyncio (reînnoirea lock-ului
    BullMQ, heartbeat-ul) să nu fie blocată de calculul CPU.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import signal
import socket
import tempfile
import traceback
from dataclasses import fields
from pathlib import Path
from typing import Any, Dict, Optional

import psycopg
from psycopg.types.json import Jsonb

from pbn_engine import ProcessingConfig, __version__ as ENGINE_VERSION, generate

from .storage import Storage, storage_from_env

log = logging.getLogger("pbn_worker")

# Cheile pe care API-ul le poate trimite în `params` (whitelist).
ALLOWED_PARAMS = {"num_colors", "canvas_width_mm", "canvas_height_mm", "fit"}
CONTENT_TYPES = {
    ".svg": "image/svg+xml", ".pdf": "application/pdf", ".json": "application/json",
    ".png": "image/png", ".jpg": "image/jpeg",
}
PREVIEW_FILES = {"painted_png", "numbered_png", "palette_png", "mockup_jpg"}
HEARTBEAT_S = 30


class JobProcessor:
    def __init__(self, database_url: str, storage: Storage, worker_id: str):
        self.database_url = database_url
        self.storage = storage
        self.worker_id = worker_id

    # ------------------------------------------------------------------
    async def _claim(self, conn, job_id: str) -> Optional[Dict[str, Any]]:
        async with conn.transaction():
            cur = await conn.execute(
                """
                UPDATE processing_jobs j
                   SET status = 'running', attempts = attempts + 1, worker_id = %s,
                       started_at = now(), heartbeat_at = now(), error = NULL
                  FROM source_images s
                 WHERE j.id = %s AND s.id = j.source_image_id
                   AND (j.status IN ('queued', 'failed')
                        -- 'running' doar dacă worker-ul anterior a murit (heartbeat expirat);
                        -- altfel două procese ar putea procesa același job simultan.
                        OR (j.status = 'running' AND j.heartbeat_at < now() - interval '2 minutes'))
                RETURNING j.id, j.kind, j.params, j.output_prefix, j.order_id, j.catalog_design_id,
                          j.source_image_id, j.attempts, j.max_attempts, j.engine_version,
                          s.storage_key, s.moderation,
                          (SELECT d.title FROM catalog_designs d WHERE d.id = j.catalog_design_id) AS title
                """,
                (self.worker_id, job_id),
            )
            row = await cur.fetchone()
            if row is None:
                return None
            cols = [d.name for d in cur.description]
            job = dict(zip(cols, row))
            await conn.execute(
                "INSERT INTO job_events (job_id, to_status, detail) VALUES (%s, 'running', %s)",
                (job_id, Jsonb({"worker": self.worker_id, "attempt": job["attempts"]})),
            )
            return job

    async def _heartbeat(self, job_id: str) -> None:
        async with await psycopg.AsyncConnection.connect(self.database_url, autocommit=True) as conn:
            while True:
                await asyncio.sleep(HEARTBEAT_S)
                await conn.execute(
                    "UPDATE processing_jobs SET heartbeat_at = now() WHERE id = %s AND worker_id = %s",
                    (job_id, self.worker_id),
                )

    @staticmethod
    def build_config(params: Dict[str, Any]) -> ProcessingConfig:
        unknown = set(params) - ALLOWED_PARAMS
        if unknown:
            raise ValueError(f"Unsupported params: {sorted(unknown)}")
        valid = {f.name for f in fields(ProcessingConfig)}
        return ProcessingConfig(**{k: v for k, v in params.items() if k in valid})

    def _run_engine(self, job: Dict[str, Any]) -> Dict[str, Any]:
        """Partea sincronă (thread): descărcare, generare, upload."""
        cfg = self.build_config(job["params"])
        prefix = job["output_prefix"]
        with tempfile.TemporaryDirectory(prefix="pbn-") as tmp:
            src = Path(tmp) / ("source" + Path(job["storage_key"]).suffix)
            src.write_bytes(self.storage.get_object("sources", job["storage_key"]))
            result = generate(src, Path(tmp) / "out", cfg, title=job.get("title"))

            artifacts = []
            ordered = sorted(result.files.items(), key=lambda kv: kv[0] == "manifest_json")  # manifest ultimul
            for kind, name in ordered:
                path = result.output_dir / name
                data = path.read_bytes()
                key = f"{prefix}{'previews/' if kind in PREVIEW_FILES else ''}{name}"
                ctype = CONTENT_TYPES[path.suffix]
                self.storage.put_object("artifacts", key, data, ctype)
                artifacts.append({"kind": kind, "key": key, "ctype": ctype, "bytes": len(data),
                                  "sha256": hashlib.sha256(data).hexdigest()})
            return {"artifacts": artifacts, "recipe": result.recipe, "stats": result.stats,
                    "source_size": _image_size(src)}

    async def _complete(self, conn, job: Dict[str, Any], out: Dict[str, Any]) -> None:
        job_id = job["id"]
        async with conn.transaction():
            for a in out["artifacts"]:
                await conn.execute(
                    """INSERT INTO job_artifacts (job_id, kind, storage_key, content_type, bytes, sha256)
                       VALUES (%s, %s, %s, %s, %s, %s)
                       ON CONFLICT (job_id, kind) DO UPDATE SET storage_key = EXCLUDED.storage_key,
                         content_type = EXCLUDED.content_type, bytes = EXCLUDED.bytes, sha256 = EXCLUDED.sha256""",
                    (job_id, a["kind"], a["key"], a["ctype"], a["bytes"], a["sha256"]),
                )
            recipe = out["recipe"]
            await conn.execute(
                """INSERT INTO paint_recipes (job_id, total_paint_ml, colors) VALUES (%s, %s, %s)
                   ON CONFLICT (job_id) DO UPDATE SET total_paint_ml = EXCLUDED.total_paint_ml,
                     colors = EXCLUDED.colors""",
                (job_id, recipe["total_paint_ml"], Jsonb(recipe["colors"])),
            )
            if out["source_size"]:
                await conn.execute(
                    """UPDATE source_images SET width_px = COALESCE(width_px, %s),
                         height_px = COALESCE(height_px, %s) WHERE id = %s""",
                    (*out["source_size"], job["source_image_id"]),
                )
            stats = out["stats"]
            await conn.execute(
                """UPDATE processing_jobs SET status = 'succeeded', finished_at = now(), stats = %s,
                     engine_version = %s, worker_id = NULL WHERE id = %s""",
                (Jsonb(stats), ENGINE_VERSION, job_id),
            )
            await conn.execute(
                "INSERT INTO job_events (job_id, from_status, to_status) VALUES (%s, 'running', 'succeeded')",
                (job_id,),
            )
            if job["catalog_design_id"]:
                # Publicat automat doar dacă sursa a trecut de moderare.
                await conn.execute(
                    """UPDATE catalog_designs SET difficulty = %s, num_regions = %s, total_paint_ml = %s,
                         published_at = CASE WHEN %s = 'approved' THEN COALESCE(published_at, now())
                                             ELSE published_at END
                       WHERE id = %s""",
                    (stats["difficulty"], stats["num_regions"], recipe["total_paint_ml"],
                     job["moderation"], job["catalog_design_id"]),
                )
            if job["order_id"]:
                await conn.execute(
                    """UPDATE orders SET status = 'awaiting_approval', updated_at = now()
                       WHERE id = %s AND status = 'awaiting_processing'""",
                    (job["order_id"],),
                )

    async def _fail(self, conn, job: Dict[str, Any], err: BaseException) -> str:
        status = "dead" if job["attempts"] >= job["max_attempts"] else "failed"
        detail = {"type": type(err).__name__, "message": str(err)[:2000],
                  "trace": traceback.format_exc()[-4000:], "attempt": job["attempts"]}
        async with conn.transaction():
            await conn.execute(
                """UPDATE processing_jobs SET status = %s, error = %s, finished_at = now(), worker_id = NULL
                   WHERE id = %s""",
                (status, Jsonb(detail), job["id"]),
            )
            await conn.execute(
                "INSERT INTO job_events (job_id, from_status, to_status, detail) VALUES (%s, 'running', %s, %s)",
                (job["id"], status, Jsonb({"message": detail["message"]})),
            )
        return status

    # ------------------------------------------------------------------
    async def process(self, job_id: str) -> Dict[str, Any]:
        async with await psycopg.AsyncConnection.connect(self.database_url) as conn:
            job = await self._claim(conn, job_id)
            if job is None:
                cur = await conn.execute("SELECT status FROM processing_jobs WHERE id = %s", (job_id,))
                row = await cur.fetchone()
                log.info("job %s skipped (status=%s)", job_id, row[0] if row else "missing")
                return {"skipped": row[0] if row else "missing"}

            log.info("job %s started (attempt %s/%s)", job_id, job["attempts"], job["max_attempts"])
            hb = asyncio.create_task(self._heartbeat(job_id))
            try:
                out = await asyncio.to_thread(self._run_engine, job)
            except Exception as err:  # noqa: BLE001 — orice eroare se înregistrează, apoi BullMQ decide retry-ul
                status = await self._fail(conn, job, err)
                log.exception("job %s %s", job_id, status)
                raise
            finally:
                hb.cancel()
            await self._complete(conn, job, out)
            log.info("job %s succeeded: %s regions", job_id, out["stats"]["num_regions"])
            return {"status": "succeeded", "numRegions": out["stats"]["num_regions"]}


def _image_size(path: Path):
    try:
        from PIL import Image

        with Image.open(path) as im:
            return im.size
    except Exception:  # noqa: BLE001
        return None


# ----------------------------------------------------------------------
async def run(env=os.environ) -> None:
    from bullmq import Worker

    logging.basicConfig(level=env.get("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(name)s %(message)s")
    processor = JobProcessor(
        database_url=env.get("DATABASE_URL", "postgres://postgres@localhost:5432/pbn"),
        storage=storage_from_env(env),
        worker_id=f"{socket.gethostname()}:{os.getpid()}",
    )

    async def handle(job, token):
        return await processor.process(job.data["jobId"])

    opts = {
        "connection": env.get("REDIS_URL", "redis://localhost:6379"),
        "prefix": env.get("QUEUE_PREFIX", "pbn"),
        "concurrency": int(env.get("WORKER_CONCURRENCY", "1")),
        # Un job mare poate dura minute: lock lung, reînnoit automat.
        "lockDuration": 120_000,
    }
    queues = [q.strip() for q in env.get("WORKER_QUEUES", "pbn-orders,pbn-catalog").split(",") if q.strip()]
    workers = [Worker(q, handle, opts) for q in queues]
    log.info("pbn_worker %s (engine %s) listening on %s", processor.worker_id, ENGINE_VERSION, queues)

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, stop.set)
    await stop.wait()
    log.info("shutting down (finishing active jobs)...")
    await asyncio.gather(*(w.close() for w in workers))
