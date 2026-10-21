"""Appeal filing deadlines: a fixed table, never computed by an LLM.

Each rule was read from the regulation text on eCFR (point-in-time 2026-10-01)
and is marked verified with the date it was checked. Anything not in the table
returns an unverified "check the notice" deadline rather than a guess.

These are the enrollee/claimant appeal windows. Contracted providers' payment
disputes with an MA plan follow their provider contract instead.
"""

from dataclasses import dataclass
from datetime import date, timedelta

from nebius_nvidia.models import Deadline, PlanType

PROVIDER_CAVEAT = (
    "Enrollee appeal window. Contracted providers' payment disputes with a Medicare Advantage plan "
    "follow the provider contract; check the denial notice."
)


@dataclass(frozen=True)
class Rule:
    rule_id: str
    level: str
    days: int
    receipt_presumption_days: int  # days added to the notice date to get the presumed receipt date
    basis: str
    citation: str
    source_url: str
    verified_on: date | None


RULES: dict[str, Rule] = {
    "MA": Rule(
        rule_id="ma-reconsideration",
        level="Plan reconsideration",
        days=60,
        receipt_presumption_days=5,
        basis="60 calendar days after receipt of the organization determination; receipt is presumed 5 days after the notice date",
        citation="42 CFR 422.582(b)",
        source_url="https://www.ecfr.gov/current/title-42/section-422.582",
        verified_on=date(2026, 10, 21),
    ),
    "MEDICARE_FFS": Rule(
        rule_id="ffs-redetermination",
        level="MAC redetermination",
        days=120,
        receipt_presumption_days=5,
        basis="120 calendar days from receipt of the initial determination; receipt is presumed 5 days after the notice date",
        citation="42 CFR 405.942(a)",
        source_url="https://www.ecfr.gov/current/title-42/section-405.942",
        verified_on=date(2026, 10, 21),
    ),
    # ACA plans (45 CFR 147.136(b)) must follow the ERISA claims rule (29 CFR 2560.503-1),
    # which gives *at least* 180 days after receipt. With no receipt presumption in the rule,
    # we count from the notice date: the earliest possible deadline, so the safe one.
    "COMMERCIAL_ACA": Rule(
        rule_id="aca-internal-appeal",
        level="Internal appeal",
        days=180,
        receipt_presumption_days=0,
        basis="At least 180 days after receipt of the adverse determination; counted from the notice date to be safe. The plan may allow longer",
        citation="45 CFR 147.136(b); 29 CFR 2560.503-1(h)(3)(i)",
        source_url="https://www.ecfr.gov/current/title-45/section-147.136",
        verified_on=date(2026, 10, 21),
    ),
    "COMMERCIAL_ERISA": Rule(
        rule_id="erisa-internal-appeal",
        level="Internal appeal",
        days=180,
        receipt_presumption_days=0,
        basis="At least 180 days after receipt of the adverse determination; counted from the notice date to be safe. The plan may allow longer",
        citation="29 CFR 2560.503-1(h)(3)(i)",
        source_url="https://www.ecfr.gov/current/title-29/section-2560.503-1",
        verified_on=date(2026, 10, 21),
    ),
}


def deadline(plan_type: PlanType, notice_date: date, today: date | None = None) -> Deadline:
    """The appeal filing deadline for a plan type, from the fixed table."""
    today = today or date.today()
    rule = RULES.get(plan_type)
    if rule is None:
        return Deadline(
            rule_id="unknown",
            due=None,
            days_left=None,
            basis="State- or plan-specific. Check the deadline printed on the denial notice.",
            citation="",
            source_url="",
            verified=False,
        )
    due = notice_date + timedelta(days=rule.receipt_presumption_days + rule.days)
    return Deadline(
        rule_id=rule.rule_id,
        due=due,
        days_left=(due - today).days,
        basis=f"{rule.level}: {rule.basis}. {PROVIDER_CAVEAT}",
        citation=rule.citation,
        source_url=rule.source_url,
        verified=rule.verified_on is not None,
    )
