"""Pornire: `python -m pbn_worker` (configurare prin variabile de mediu, vezi README)."""
import asyncio

from .worker import run

if __name__ == "__main__":
    asyncio.run(run())
