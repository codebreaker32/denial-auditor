from nebius_nvidia.text import html_to_text, locate, normalize


def test_html_to_text_double_escaped():
    raw = "&lt;p&gt;Red flags &amp;amp; more&lt;&sol;p&gt;&lt;ul&gt;&lt;li&gt;Fever&lt;&sol;li&gt;&lt;li&gt;Chills&lt;&sol;li&gt;&lt;&sol;ul&gt;"
    assert html_to_text(raw) == "Red flags & more\n\n• Fever\n• Chills"


def test_html_to_text_strips_comments_and_nbsp():
    raw = "&lt;p&gt;&lt;!&amp;mdash;StartFragment &amp;mdash;&gt;at least&amp;nbsp;four weeks&lt;&sol;p&gt;"
    assert html_to_text(raw) == "at least four weeks"


def test_html_to_text_empty():
    assert html_to_text(None) == ""
    assert html_to_text("") == ""


def test_normalize_forgives_quotes_whitespace_invisibles():
    assert normalize("“red flag”  is\n\tnoted​") == '"red flag" is noted'


def test_normalize_keeps_case_digits_dashes():
    assert normalize("6-week Trial") != normalize("6 week trial")
    assert normalize("four") != normalize("Four")


def test_locate_returns_original_offsets():
    text = "Intro.\n\nMRI will be covered  only if the patient\nhas not responded."
    span = "covered only if the patient has not"
    start, end = locate(span, text)
    assert normalize(text[start:end]) == span
    assert text[start:end].startswith("covered")
    assert text[start:end].endswith("not")


def test_locate_curly_quotes_match_straight():
    text = "a “red flag” (suggesting a medically emergent condition)"
    assert locate('"red flag" (suggesting', text) is not None


def test_locate_rejects_changed_word_and_empty():
    text = "lasting at least four weeks."
    assert locate("lasting at least two weeks", text) is None
    assert locate("", text) is None
    assert locate("   ", text) is None
