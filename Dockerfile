FROM python:3.11-slim

# System deps for psycopg2, geopandas, lightgbm
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libpq-dev libgeos-dev libproj-dev gdal-bin \
    libgdal-dev python3-dev curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Create model artifact directory
RUN mkdir -p models/artifacts

EXPOSE 8000

ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "run.py"]
