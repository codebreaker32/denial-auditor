"""Per-step and per-case cost accounting for the UI and the eval.

This only *reports* cost; the hard caps live in budget.py and are unaffected.
"""

from nebius_nvidia.models import StepTrace


class CostTracker:
    def __init__(self) -> None:
        self.steps: list[StepTrace] = []

    def record(self, trace: StepTrace) -> None:
        self.steps.append(trace)

    @property
    def total_usd(self) -> float:
        return round(sum(s.cost_usd for s in self.steps), 6)

    def by_model(self) -> dict[str, float]:
        out: dict[str, float] = {}
        for s in self.steps:
            out[s.model] = out.get(s.model, 0.0) + s.cost_usd
        return out
