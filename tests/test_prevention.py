from datetime import date

from nebius_nvidia.models import FactsView, TreatmentSpan
from nebius_nvidia.prevention import earliest_date

PLANNED = date(2026, 7, 10)


def _view(onset=date(2026, 6, 1), spans=((date(2026, 6, 20), date(2026, 7, 5)),)):
    tx = [TreatmentSpan(kind="physical_therapy", start=a, end=b) for a, b in spans]
    days = (max(b for _, b in spans) - min(a for a, _ in spans)).days if spans else None
    return FactsView(onset=onset, treatments=tx, conservative_days=days)


def test_shortfall_is_made_up_from_the_last_session():
    # L34220: onset + 30 = 07/01 (met by 07/10); care 06/20→07/05 = 15 of 28 days → 07/05 + 13 = 07/18.
    d, basis = earliest_date("L34220", _view(), PLANNED)
    assert d == date(2026, 7, 18) and len(basis) == 2


def test_care_that_stopped_early_still_falls_short():
    # Aetna: 06/19→07/27 is 38 of 42 days. 6 weeks from the first visit (07/31) is before the
    # planned date, but the chart doesn't document it, so it's still "not yet".
    d, _ = earliest_date("Aetna CPB 0236", _view(spans=((date(2026, 6, 19), date(2026, 7, 27)),)), date(2026, 8, 3))
    assert d == date(2026, 7, 31)


def test_nothing_short_means_no_date():
    long = _view(spans=((date(2026, 5, 1), date(2026, 7, 1)),))
    assert earliest_date("L34220", long, PLANNED) == (None, [])


def test_no_date_without_a_verified_clock_start():
    assert earliest_date("L34220", _view(onset=None), PLANNED) == (None, [])
    assert earliest_date("Aetna CPB 0236", _view(spans=()), PLANNED) == (None, [])
