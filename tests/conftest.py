import json
import os
from pathlib import Path

import httpx
import pytest

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def no_network(monkeypatch, request):
    """Unit tests must never spend credits: real HTTP transports raise, keys are unset."""
    if request.node.get_closest_marker("live"):
        return

    def refuse(self, req):
        raise RuntimeError(f"Network call in a unit test: {req.method} {req.url}")

    monkeypatch.setattr(httpx.HTTPTransport, "handle_request", refuse)
    for key in ("NEBIUS_TOKEN_FACTORY_KEY", "TAVILY_API_KEY"):
        monkeypatch.delenv(key, raising=False)


def pytest_collection_modifyitems(config, items):
    if os.environ.get("RUN_LIVE") == "1":
        return
    skip = pytest.mark.skip(reason="live test; set RUN_LIVE=1")
    for item in items:
        if "live" in item.keywords:
            item.add_marker(skip)


@pytest.fixture(scope="session")
def cms_fixture() -> dict:
    return json.loads((FIXTURES / "cms_lcd.json").read_text())
