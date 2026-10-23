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


def test_normalize_stray_space_before_punctuation():
    assert normalize("condition , such") == normalize("condition, such")
    assert locate('a "red-flag" condition, such as', "a “red-flag” condition , such as x") is not None


def test_segment_sentences_bullets_and_abbreviations():
    from nebius_nvidia.text import segment

    text = 'First sentence here. Second one (e.g. an example) continues. "Quoted" third.\n\n"Red flags" include:\n\n• Fever\n\n• Chills'
    units = [text[s:e] for s, e in segment(text)]
    assert units == [
        "First sentence here.",
        "Second one (e.g. an example) continues.",
        '"Quoted" third.',
        '"Red flags" include:',
        "• Fever",
        "• Chills",
    ]


def test_build_criteria_runs_and_range(cms_fixture):
    from nebius_nvidia.cms import lcd_from_row
    from nebius_nvidia.criteria import CriterionPick, build_criteria, numbered

    doc = lcd_from_row(cms_fixture["L34220_v40"][0])
    _, units = numbered(doc)
    crit = build_criteria([CriterionPick(summary="x", kind="red_flag", sentence_ids=[10, 11, 12, 30, 9999])], doc, units)
    assert len(crit) == 2  # [10-12] and [30]; 9999 dropped
    assert all(c.span_verified and doc.text[c.span_start : c.span_end] == c.verbatim_span for c in crit)


def test_realign_shifts_off_by_one_pick(cms_fixture):
    from nebius_nvidia.cms import lcd_from_row
    from nebius_nvidia.criteria import CriterionPick, build_criteria, numbered

    doc = lcd_from_row(cms_fixture["L34220_v40"][0])
    _, units = numbered(doc)
    target = next(i for i, (s, e) in enumerate(units, 1) if "lasting at least four weeks" in doc.text[s:e])
    words = " ".join(doc.text[units[target - 1][0] : units[target - 1][1]].split()[:6])
    for wrong in (target - 1, target + 1, target):
        crit = build_criteria([CriterionPick(summary="x", kind="duration", sentence_ids=[wrong], first_words=words)], doc, units)
        assert "lasting at least four weeks" in crit[0].verbatim_span


def test_heading_only_pick_dropped(cms_fixture):
    from nebius_nvidia.cms import lcd_from_row
    from nebius_nvidia.criteria import CriterionPick, build_criteria, numbered

    doc = lcd_from_row(cms_fixture["L34220_v40"][0])
    _, units = numbered(doc)
    assert build_criteria([CriterionPick(summary="x", kind="duration", sentence_ids=[1])], doc, units) == []


def test_hyphen_variants_match_but_dashes_dont():
    assert normalize("L4‑L5 injection") == normalize("L4-L5 injection")
    assert normalize("L4‐L5") == normalize("L4-L5")
    assert normalize("4–6 weeks") != normalize("4-6 weeks")  # en dash stays distinct
