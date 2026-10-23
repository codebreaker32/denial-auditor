# Denial Auditor: Streamlit app image (deployed on AWS Lightsail).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
# DejaVu fonts for letter rendering; nothing else from apt.
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*

WORKDIR /srv
COPY pyproject.toml README.md LICENSE ./
COPY src ./src
RUN pip install ".[app]"
COPY web ./web
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
CMD ["uvicorn", "nebius_nvidia.api:app", "--host", "0.0.0.0", "--port", "8501"]
