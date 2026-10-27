# Denial Auditor: web app image (deployed on AWS Lightsail).
# The shadcn frontend (ui/) is built in a Node stage; only its static dist/ ships.
FROM node:24-slim AS ui
WORKDIR /ui
COPY ui/package.json ui/package-lock.json ./
RUN npm ci
COPY ui ./
RUN npm run build

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
# DejaVu fonts for letter rendering; nothing else from apt.
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY pyproject.toml README.md LICENSE ./
COPY src ./src
RUN pip install ".[app]"
COPY web ./web
COPY --from=ui /ui/dist ./ui/dist
COPY cases ./cases
COPY demo ./demo
COPY eval/gold ./eval/gold

# Ledgers and caches live on a mounted volume so spend survives restarts.
ENV TOKEN_FACTORY_LEDGER=/state/tf_spend.json \
    TAVILY_LEDGER=/state/tavily_spend.json \
    TOKEN_FACTORY_BUDGET_USD=4 \
    TAVILY_CREDIT_CAP=1200
VOLUME ["/state"]

ENV DA_ROOT=/srv
EXPOSE 8501
# The policy watch runs beside the app: once at start, then nightly at 03:00 UTC, with a $0 model cap.
CMD ["sh", "-c", "python -m nebius_nvidia.drift --nightly & exec uvicorn nebius_nvidia.api:app --host 0.0.0.0 --port 8501"]
