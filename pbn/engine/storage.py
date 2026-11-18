"""
Stocare fișiere — local (dev) sau S3/R2/GCS-compatibil-S3 (producție).

Organizare chei (prefixe stabile => lifecycle rules + CDN simplu):
  catalog/{category}/{source}-{photo_id}/v{engine_version}/{canvas.svg|preview.png|mockup.jpg|recipe.json}
  orders/{yyyy}/{mm}/{order_id}/source/original.{ext}        <- poza clientului (ștearsă automat după 30 zile)
  orders/{yyyy}/{mm}/{order_id}/job-{job_id}/{canvas.svg|canvas.pdf|recipe.json|preview.png}
  production/{yyyy-mm-dd}/{order_id}.zip                      <- pachetul trimis la print/fabrică

Setați STORAGE_BACKEND=s3 și S3_BUCKET, (opțional) S3_ENDPOINT_URL pentru Cloudflare R2 / MinIO.
"""
from __future__ import annotations

import mimetypes
import os
import shutil
from pathlib import Path

CONTENT_TYPES = {".svg": "image/svg+xml", ".json": "application/json", ".pdf": "application/pdf"}


class Storage:
    def put_dir(self, local_dir: Path, prefix: str) -> dict[str, str]:
        out = {}
        for f in sorted(Path(local_dir).iterdir()):
            if f.is_file():
                out[f.name] = self.put_file(f, f"{prefix.rstrip('/')}/{f.name}")
        return out

    def put_file(self, local: Path, key: str) -> str:  # pragma: no cover - interfață
        raise NotImplementedError


class LocalStorage(Storage):
    def __init__(self, root: str | Path = "storage"):
        self.root = Path(root)

    def put_file(self, local: Path, key: str) -> str:
        dst = self.root / key
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(local, dst)
        return str(dst)


class S3Storage(Storage):
    def __init__(self, bucket: str, endpoint_url: str | None = None):
        import boto3  # dependență opțională
        self.bucket = bucket
        self.s3 = boto3.client("s3", endpoint_url=endpoint_url)

    def put_file(self, local: Path, key: str) -> str:
        ctype = CONTENT_TYPES.get(local.suffix) or mimetypes.guess_type(local.name)[0] or "application/octet-stream"
        self.s3.upload_file(str(local), self.bucket, key, ExtraArgs={
            "ContentType": ctype,
            "ServerSideEncryption": "AES256",
            # fișierele de catalog sunt imutabile per versiune -> cache agresiv pe CDN
            "CacheControl": "public, max-age=31536000, immutable" if key.startswith("catalog/") else "private, no-store",
        })
        return f"s3://{self.bucket}/{key}"


def get_storage() -> Storage:
    if os.getenv("STORAGE_BACKEND", "local") == "s3":
        return S3Storage(os.environ["S3_BUCKET"], os.getenv("S3_ENDPOINT_URL"))
    return LocalStorage(os.getenv("LOCAL_STORAGE_DIR", "storage"))
