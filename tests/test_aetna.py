import pytest

from nebius_nvidia.aetna import CPB_URL, CpbNotFound, policy_section

# Tiny made-up page with the same layout markers as an Aetna bulletin (no Aetna content).
PAGE = """<h3>Scope of Policy</h3><p>Covers widgets.</p>
<h3>Medical Necessity</h3><p>Widgets are covered when&nbsp;<em>any</em> of the following is met:</p>
<ul><li class="bullet">Persistent pain and no improvement after 6 weeks of therapy<a><span class="sr-only">Footnote1</span>*</a>; <em>or</em></li>
<li class="bullet"></li></ul>
<h3>Related Policies</h3><ul><li>CPB 0001 - Other</li></ul>
<h2>CPT Codes / HCPCS Codes / ICD-10 Codes</h2><table><tr><td>99999</td><td>Some AMA descriptor</td></tr></table>"""


def test_policy_section_cuts_code_tables_and_related():
    text = policy_section(PAGE)
    assert "no improvement after 6 weeks of therapy*; or" in text
    assert "Footnote1" not in text
    assert "99999" not in text and "descriptor" not in text
    assert "Related Policies" not in text and "CPB 0001" not in text
    assert "\n•\n" not in text


def test_unexpected_layout_raises():
    with pytest.raises(CpbNotFound):
        policy_section("<p>nothing here</p>")


def test_cpb_url_pattern():
    assert CPB_URL.match("https://www.aetna.com/cpb/medical/data/200_299/0236.html").group(2) == "0236"
    assert not CPB_URL.match("https://www.evicore.com/cpb/medical/data/200_299/0236.html")
