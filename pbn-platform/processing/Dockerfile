FROM python:3.12-slim
# libcairo2: export PDF; libgl1/libglib2.0-0: OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends libcairo2 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY pbn_engine ./pbn_engine
COPY pbn_worker ./pbn_worker
RUN useradd -m -u 1000 worker && mkdir -p /data/storage && chown worker /data/storage  # același UID ca user-ul node (1000): volum partajat
USER worker
CMD ["python", "-m", "pbn_worker"]
