#!/usr/bin/env bash
# Deploy Denial Auditor to an AWS Lightsail container service, or tear it down.
#
#   scripts/deploy.sh up       build image, create service if needed, push, deploy, print URL
#   scripts/deploy.sh down     DELETE the service (Lightsail bills until deletion; run at every wrap-up)
#   scripts/deploy.sh status   show services that exist (and therefore cost money)
#
# Uses the restricted AWS profile `aman-deploy` (Lightsail-only IAM user) in us-east-1.
# API keys are read from .env into the deployment config and never printed.
set -euo pipefail

SERVICE=denial-auditor
POWER=${POWER:-small}        # small = 0.5 vCPU / 1 GB, $15/month, billed hourly
PROFILE=${PROFILE:-aman-deploy}
REGION=${REGION:-us-east-1}
IMAGE=denial-auditor:latest
AWS=(aws --profile "$PROFILE" --region "$REGION")
export PATH="$HOME/.local/bin:$PATH"   # lightsailctl
cd "$(dirname "$0")/.."

state() { "${AWS[@]}" lightsail get-container-services --service-name "$SERVICE" --query 'containerServices[0].state' --output text 2>/dev/null || echo NONE; }

case "${1:-}" in
  up)
    if ! command -v docker >/dev/null || ! docker info >/dev/null 2>&1; then
      echo "ERROR: Docker isn't available. Start Docker Desktop (with WSL integration on) and retry." >&2
      exit 1
    fi
    docker build -q -t "$IMAGE" . >/dev/null || { echo "ERROR: docker build failed" >&2; exit 1; }
    if [ "$(state)" = NONE ]; then
      echo "creating container service ($POWER)…"
      "${AWS[@]}" lightsail create-container-service --service-name "$SERVICE" --power "$POWER" --scale 1 \
        --tags key=project,value=denial-auditor >/dev/null
    fi
    until [[ "$(state)" =~ ^(READY|RUNNING)$ ]]; do echo "  service: $(state)"; sleep 15; done
    echo "pushing image…"
    REF=$("${AWS[@]}" lightsail push-container-image --service-name "$SERVICE" --label app --image "$IMAGE" \
          | grep -o "\"[^\"]*:$SERVICE\.app\.[0-9]*\"" | tail -1 | tr -d '"')
    [ -n "$REF" ] || { echo "push failed"; exit 1; }
    TMP=$(mktemp); chmod 600 "$TMP"; trap 'rm -f "$TMP"' EXIT
    ./.venv/bin/python - "$REF" > "$TMP" <<'PY'
import json, sys
from dotenv import dotenv_values
env = dotenv_values(".env")
print(json.dumps({"app": {
    "image": sys.argv[1],
    "ports": {"8501": "HTTP"},
    "environment": {
        "NEBIUS_TOKEN_FACTORY_KEY": env["NEBIUS_TOKEN_FACTORY_KEY"],
        "TAVILY_API_KEY": env["TAVILY_API_KEY"],
        "TOKEN_FACTORY_BUDGET_USD": "4",
        "TAVILY_CREDIT_CAP": "1200",
        "DEMO_PASSCODE": env.get("DEMO_PASSCODE", ""),
    },
}}))
PY
    "${AWS[@]}" lightsail create-container-service-deployment --service-name "$SERVICE" \
      --containers "file://$TMP" \
      --public-endpoint '{"containerName":"app","containerPort":8501,"healthCheck":{"path":"/healthz","successCodes":"200"}}' >/dev/null
    echo "deploying…"
    until [ "$(state)" = RUNNING ] && [ "$("${AWS[@]}" lightsail get-container-services --service-name "$SERVICE" \
            --query 'containerServices[0].currentDeployment.state' --output text)" = ACTIVE ]; do
      echo "  $(state) / $("${AWS[@]}" lightsail get-container-services --service-name "$SERVICE" --query 'containerServices[0].nextDeployment.state' --output text 2>/dev/null)"
      sleep 20
    done
    echo "URL: $("${AWS[@]}" lightsail get-container-services --service-name "$SERVICE" --query 'containerServices[0].url' --output text)"
    ;;
  down)
    if [ "$(state)" = NONE ]; then echo "nothing to delete"; exit 0; fi
    "${AWS[@]}" lightsail delete-container-service --service-name "$SERVICE"
    echo "deleted container service $SERVICE"
    ;;
  status)
    "${AWS[@]}" lightsail get-container-services --query 'containerServices[].{name:containerServiceName,state:state,power:power,url:url}' --output table
    "${AWS[@]}" lightsail get-instances --query 'instances[].{name:name,state:state.name}' --output table
    ;;
  *) echo "usage: $0 up|down|status"; exit 2 ;;
esac
