"""
Stocare pentru worker — aceeași organizare și aceleași bucket-uri logice
('sources', 'artifacts') ca în API (api/src/storage/index.js).
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Optional, Protocol


class Storage(Protocol):
    def get_object(self, bucket: str, key: str) -> bytes: ...
    def put_object(self, bucket: str, key: str, body: bytes, content_type: str) -> None: ...


class LocalStorage:
    """Driver de dezvoltare: același director ca LOCAL_STORAGE_DIR din API."""

    def __init__(self, root: str):
        self.root = Path(root).resolve()

    def _path(self, bucket: str, key: str) -> Path:
        if bucket not in ("sources", "artifacts"):
            raise ValueError(f"Unknown bucket {bucket}")
        p = (self.root / bucket / key).resolve()
        if self.root not in p.parents:
            raise ValueError("Path traversal")
        return p

    def get_object(self, bucket: str, key: str) -> bytes:
        return self._path(bucket, key).read_bytes()

    def put_object(self, bucket: str, key: str, body: bytes, content_type: str) -> None:
        p = self._path(bucket, key)
        p.parent.mkdir(parents=True, exist_ok=True)
        tmp = p.with_suffix(p.suffix + ".tmp")
        tmp.write_bytes(body)
        tmp.replace(p)  # scriere atomică


class S3Storage:
    def __init__(self, buckets: dict, region: str, endpoint: Optional[str] = None):
        import boto3  # import local: dependență doar pentru producție

        self.client = boto3.client("s3", region_name=region, endpoint_url=endpoint)
        self.buckets = buckets

    def get_object(self, bucket: str, key: str) -> bytes:
        return self.client.get_object(Bucket=self.buckets[bucket], Key=key)["Body"].read()

    def put_object(self, bucket: str, key: str, body: bytes, content_type: str) -> None:
        extra = {}
        if key.endswith((".svg", ".pdf", ".json")):
            # Fișierele de producție se descarcă, nu se afișează în browser.
            extra["ContentDisposition"] = f'attachment; filename="{key.rsplit("/", 1)[-1]}"'
        self.client.put_object(Bucket=self.buckets[bucket], Key=key, Body=body,
                               ContentType=content_type, **extra)


def storage_from_env(env=os.environ) -> Storage:
    if env.get("STORAGE_DRIVER", "local") == "s3":
        return S3Storage(
            buckets={"sources": env["S3_BUCKET_SOURCES"], "artifacts": env["S3_BUCKET_ARTIFACTS"]},
            region=env.get("S3_REGION", "eu-central-1"),
            endpoint=env.get("S3_ENDPOINT") or None,
        )
    return LocalStorage(env.get("LOCAL_STORAGE_DIR", "./.data/storage"))
