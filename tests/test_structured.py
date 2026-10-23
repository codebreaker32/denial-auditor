from types import SimpleNamespace

import pytest
from pydantic import BaseModel

from nebius_nvidia.cost import CostTracker
from nebius_nvidia.llm import LLMFormatError, _extract_json, structured


class Out(BaseModel):
    city: str
    weeks: int


class FakeClient:
    """Returns scripted contents in order and records the kwargs of each call."""

    def __init__(self, contents):
        self.contents = list(contents)
        self.calls = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    def _create(self, **kwargs):
        self.calls.append(kwargs)
        content = self.contents.pop(0)
        return SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content=content), finish_reason="stop" if content else "length")],
            usage=SimpleNamespace(prompt_tokens=10, completion_tokens=5),
        )


def run(contents, **kw):
    fc = FakeClient(contents)
    tracker = CostTracker()
    out = structured("m", [{"role": "user", "content": "q"}], Out, max_tokens=100, step="t", tracker=tracker, client=fc, **kw)
    return out, fc, tracker


def test_leading_newline_and_prose():
    out, fc, _ = run(['\nSure! {"city": "Paris", "weeks": 4} hope that helps'])
    assert out == Out(city="Paris", weeks=4)
    assert len(fc.calls) == 1


def test_code_fence():
    out, _, _ = run(['```json\n{"city": "Paris", "weeks": 4}\n```'])
    assert out.weeks == 4


def test_empty_content_retries_with_double_tokens():
    out, fc, tracker = run(["", '{"city": "Paris", "weeks": 4}'])
    assert out.city == "Paris"
    assert [c["max_tokens"] for c in fc.calls] == [100, 200]
    assert tracker.steps[0].attempts == 2
    assert tracker.steps[0].prompt_tokens == 20


def test_invalid_then_repair():
    out, fc, _ = run(['{"city": "Paris", "weeks": "four"}', '{"city": "Paris", "weeks": 4}'])
    assert out.weeks == 4
    assert "invalid" in fc.calls[1]["messages"][-1]["content"]


def test_gives_up_after_one_repair():
    with pytest.raises(LLMFormatError):
        run(['{"city": 1}', '{"city": 2}'])


def test_gives_up_after_two_empties():
    with pytest.raises(LLMFormatError):
        run(["", ""])


def test_tracker_records_even_on_failure():
    fc = FakeClient(["", ""])
    tracker = CostTracker()
    with pytest.raises(LLMFormatError):
        structured("m", [], Out, max_tokens=10, step="s", tracker=tracker, client=fc)
    assert len(tracker.steps) == 1 and tracker.steps[0].attempts == 2


def test_schema_in_system_prompt_and_thinking_flag():
    _, fc, _ = run(['{"city": "Paris", "weeks": 4}'], thinking=False)
    assert fc.calls[0]["messages"][0]["role"] == "system"
    assert '"weeks"' in fc.calls[0]["messages"][0]["content"]
    assert fc.calls[0]["extra_body"] == {"chat_template_kwargs": {"enable_thinking": False}}


def test_extract_json_ignores_braces_in_strings():
    assert _extract_json('note: {"city": "a}b", "weeks": 1} end') == '{"city": "a}b", "weeks": 1}'


def test_transient_errors_retry(monkeypatch):
    import httpx
    import openai

    import sys

    llm_mod = sys.modules["nebius_nvidia.llm"]

    monkeypatch.setattr(llm_mod.time, "sleep", lambda s: None)
    fc = FakeClient(['{"city": "Paris", "weeks": 4}'])
    real = fc.chat.completions.create
    fails = iter([True, True, False])

    def flaky(**kw):
        if next(fails):
            raise openai.InternalServerError("worker overloaded", response=httpx.Response(529, request=httpx.Request("POST", "http://x")), body=None)
        return real(**kw)

    fc.chat.completions.create = flaky
    out = structured("m", [], Out, max_tokens=10, step="s", client=fc)
    assert out.weeks == 4
