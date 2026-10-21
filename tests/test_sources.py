import pytest

from nebius_nvidia.sources import BlockedSource, assert_allowed, filter_results, is_allowed


@pytest.mark.parametrize(
    "url",
    [
        "https://www.evicore.com/provider/clinical-guidelines",
        "https://guidelines.carelonmedicalbenefitsmanagement.com/current-radiology-guidelines/",
        "https://acsearch.acr.org/list",
        "https://www.acr.org/Legal",
        "https://EVICORE.COM/x",
    ],
)
def test_blocked(url):
    assert not is_allowed(url)
    with pytest.raises(BlockedSource):
        assert_allowed(url)


@pytest.mark.parametrize(
    "url",
    [
        "https://www.cms.gov/medicare-coverage-database/view/lcd.aspx?lcdid=34220&ver=40",
        "https://www.aetna.com/cpb/medical/data/200_299/0236.html",
        "https://notevicore.com/page",  # look-alike host is a different domain
        "https://evicore.com.example.org/page",
    ],
)
def test_allowed(url):
    assert is_allowed(url)
    assert_allowed(url)


def test_filter_results():
    results = [{"url": "https://www.cms.gov/a"}, {"url": "https://www.evicore.com/b"}, {"url": ""}]
    assert filter_results(results) == [{"url": "https://www.cms.gov/a"}, {"url": ""}]
