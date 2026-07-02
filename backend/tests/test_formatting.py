"""Tests for CLP formatting and month utilities."""
from coinco_rep.domain.formatting import current_month_key, fmt_clp, format_date_short, month_label


def test_fmt_clp_positive():
    result = fmt_clp(45000)
    assert "45" in result and "000" in result


def test_fmt_clp_zero():
    result = fmt_clp(0)
    assert "0" in result


def test_month_label():
    assert month_label("2026-06") == "junio 2026"
    assert month_label("2026-01") == "enero 2026"
    assert month_label("2026-12") == "diciembre 2026"


def test_format_date_short():
    assert format_date_short("2026-06-05") == "5 jun"
    assert format_date_short("2026-01-01") == "1 ene"


def test_current_month_key_format():
    key = current_month_key()
    parts = key.split("-")
    assert len(parts) == 2
    assert len(parts[1]) == 2
