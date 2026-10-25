"""Policy watch: nightly check that the policy each open case cites is still the right one.

No model is called (the run sets the Token Factory cap to $0). For every saved case
run and prior-auth check:
  - CMS LCDs: compare the cited version with the current one in the CMS LCD list. A newer
    version matters to the case only if it is in effect on the case's date of service
    (or planned date, for a prior-auth check).
  - Aetna CPBs (snapshots): re-fetch the bulletin and compare its text hash.
When the text moved, each rule's verbatim policy span is looked up in the new text, so
the report names exactly which rules changed wording.

CLI:  ./.venv/bin/python -m nebius_nvidia.drift            # one pass, writes the report
      ./.venv/bin/python -m nebius_nvidia.drift --nightly  # loop: one pass a day at 03:00 UTC
"""

import argparse
import json
import os
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from pydantic import BaseModel, Field

from nebius_nvidia.models import CaseRun, Criterion, PolicyDoc, PriorAuthCheck
from nebius_nvidia.text import locate

ROOT = Path(os.environ.get("DA_ROOT", Path(__file__).resolve().parents[2]))
STATE = Path("/state") if Path("/state").is_dir() else ROOT / ".cache"
REPORT = STATE / "drift_report.json"
RUN_HOUR_UTC = 3


class DriftItem(BaseModel):
    case_id: str
    kind: str  # "denial" or "prior_auth"
    policy_id: str
    cited: str  # version or snapshot date
    current: str | None = None
    service_date: date
    status: str  # "current", "newer_version", "text_changed", "error"
    affects_case: bool = False  # the newer version or changed text applies on the service date
    changed_rules: list[dict] = Field(default_factory=list)  # {criterion_id, summary}
    note: str = ""


class DriftReport(BaseModel):
    checked_at: datetime
    items: list[DriftItem]


def changed_rules(criteria: list[Criterion], new_text: str) -> list[dict]:
    """Rules whose verbatim policy wording no longer appears in the new text."""
    return [{"criterion_id": c.criterion_id, "summary": c.summary}
            for c in criteria if c.span_verified and locate(c.verbatim_span, new_text) is None]


def check_one(case_id: str, kind: str, policy: PolicyDoc, criteria: list[Criterion], service_date: date) -> DriftItem:
    item = DriftItem(case_id=case_id, kind=kind, policy_id=policy.policy_id, cited=policy.version,
                     service_date=service_date, status="current")
    try:
        if policy.source == "cms-lcd":
            from nebius_nvidia.cms import cms

            lcd = int(policy.policy_id.lstrip("L"))
            current = cms().current_version(lcd)
            item.current = str(current)
            if current != int(policy.version):
                new = cms().lcd(lcd, current)
                item.status = "newer_version"
                item.affects_case = new.in_effect_on(service_date)
                item.changed_rules = changed_rules(criteria, new.text)
                item.note = (f"v{current} (eff {new.effective_from:%m/%d/%Y}) "
                             + ("covers this service date: re-run the case." if item.affects_case
                                else "starts after this service date; the cited version still applies."))
        elif policy.source == "aetna-cpb":
            from nebius_nvidia.aetna import fetch_cpb

            new = fetch_cpb(policy.url)  # today's snapshot (cached per day)
            item.current = new.version
            if new.sha256 != policy.sha256:
                item.status = "text_changed"
                item.affects_case = True  # snapshots carry no effective dates, so assume it applies
                item.changed_rules = changed_rules(criteria, new.text)
                item.note = (f"The bulletin's text changed since {policy.version}; "
                             + (f"{len(item.changed_rules)} rule(s) changed wording." if item.changed_rules
                                else "none of this case's rules changed wording."))
    except Exception as e:  # noqa: BLE001 - one unreachable source shouldn't stop the watch
        item.status, item.note = "error", f"{type(e).__name__}: {str(e)[:200]}"
    return item


def watch() -> DriftReport:
    items = []
    for p in sorted((ROOT / "demo" / "runs").glob("case_*.json")):
        run = CaseRun.model_validate_json(p.read_text())
        if run.policy:
            items.append(check_one(run.case_id, "denial", run.policy, run.criteria, run.denial.dos))
    for p in sorted((ROOT / "demo" / "checks").glob("case_*.json")):
        ch = PriorAuthCheck.model_validate_json(p.read_text())
        if ch.policy:
            items.append(check_one(ch.case_id, "prior_auth", ch.policy, ch.criteria, ch.request.planned_dos))
    report = DriftReport(checked_at=datetime.now(timezone.utc), items=items)
    STATE.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(report.model_dump_json(indent=1))
    return report


def seconds_until_next_run(now: datetime) -> float:
    nxt = now.replace(hour=RUN_HOUR_UTC, minute=0, second=0, microsecond=0)
    if nxt <= now:
        nxt += timedelta(days=1)
    return (nxt - now).total_seconds()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--nightly", action="store_true", help="run now, then every day at 03:00 UTC")
    args = ap.parse_args()
    os.environ["TOKEN_FACTORY_BUDGET_USD"] = "0"  # this process never calls a model; the cap enforces it
    while True:
        r = watch()
        flagged = [i for i in r.items if i.status != "current"]
        print(f"{r.checked_at:%Y-%m-%d %H:%M} UTC: {len(r.items)} cases checked, {len(flagged)} flagged", flush=True)
        for i in flagged:
            print(f"  {i.case_id} {i.policy_id} {i.cited}→{i.current} {i.status}: {i.note}", flush=True)
        if not args.nightly:
            return
        time.sleep(seconds_until_next_run(datetime.now(timezone.utc)))


if __name__ == "__main__":
    main()
