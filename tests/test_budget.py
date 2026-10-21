import json

import httpx
import pytest

from nebius_nvidia import budget
from nebius_nvidia.budget import BudgetExceeded, BudgetTransport

PRICES = {"cheap": (1e-6, 2e-6)}


@pytest.fixture
def transport(tmp_path, monkeypatch):
    monkeypatch.setenv("TOKEN_FACTORY_LEDGER", str(tmp_path / "ledger.json"))
    monkeypatch.setattr(budget, "_prices", lambda base_url, key: PRICES)
    t = BudgetTransport("https://tf.example/v1/", "k")

    def upstream(req):
        return httpx.Response(200, json={"usage": {"prompt_tokens": 1000, "completion_tokens": 500}})

    t._inner = httpx.MockTransport(upstream)
    return t


def post(transport, body):
    return transport.handle_request(httpx.Request("POST", "https://tf.example/v1/chat/completions", content=json.dumps(body)))


def test_records_actual_usage(transport, monkeypatch):
    monkeypatch.setenv("TOKEN_FACTORY_BUDGET_USD", "1")
    post(transport, {"model": "cheap", "max_tokens": 100, "messages": []})
    assert budget.spent_usd() == pytest.approx(1000 * 1e-6 + 500 * 2e-6)


def test_refuses_when_worst_case_exceeds_cap(transport, monkeypatch):
    monkeypatch.setenv("TOKEN_FACTORY_BUDGET_USD", "0.0001")
    with pytest.raises(BudgetExceeded):
        post(transport, {"model": "cheap", "max_tokens": 1000, "messages": []})
    assert budget.spent_usd() == 0


def test_refuses_streaming(transport):
    with pytest.raises(BudgetExceeded):
        post(transport, {"model": "cheap", "stream": True})


def test_refuses_unknown_model(transport):
    with pytest.raises(BudgetExceeded):
        post(transport, {"model": "mystery", "max_tokens": 10})


def test_zero_cap_blocks_everything(transport, monkeypatch):
    """The drift job runs with TOKEN_FACTORY_BUDGET_USD=0 so any LLM call is refused."""
    monkeypatch.setenv("TOKEN_FACTORY_BUDGET_USD", "0")
    with pytest.raises(BudgetExceeded):
        post(transport, {"model": "cheap", "max_tokens": 1})


def test_ledger_survives_concurrent_updates(tmp_path):
    """Regression: the lock was released before the write was flushed, so parallel
    calls could read an empty file and reset the ledger to zero."""
    from concurrent.futures import ThreadPoolExecutor

    path = str(tmp_path / "ledger.json")

    def add(_):
        with budget._locked_json(path, {"n": 0}) as data:
            data["n"] += 1

    with ThreadPoolExecutor(16) as pool:
        list(pool.map(add, range(400)))
    with budget._locked_json(path, {"n": 0}) as data:
        assert data["n"] == 400
