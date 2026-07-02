"""CLP formatting and date helpers mirroring the prototype's fmtCLP / monthLabel."""
import locale
from datetime import date

MONTH_NAMES_ES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]
MONTH_NAMES_SHORT_ES = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic",
]


def fmt_clp(amount: float) -> str:
    """Format an amount as CLP with thousands separator, e.g. $45.000."""
    rounded = round(amount)
    try:
        locale.setlocale(locale.LC_ALL, "es_CL.UTF-8")
        return locale.currency(rounded, grouping=True, symbol=True)
    except locale.Error:
        # Fallback: manual formatting with . as thousands separator
        formatted = f"{abs(rounded):,}".replace(",", ".")
        sign = "-" if rounded < 0 else ""
        return f"{sign}${formatted}"


def month_label(month_key: str) -> str:
    """Convert 'YYYY-MM' to 'enero 2026'."""
    year, month = month_key.split("-")
    return f"{MONTH_NAMES_ES[int(month) - 1]} {year}"


def format_date_short(date_str: str) -> str:
    """Convert 'YYYY-MM-DD' to '5 jun'."""
    if not date_str:
        return ""
    d = date.fromisoformat(date_str)
    return f"{d.day} {MONTH_NAMES_SHORT_ES[d.month - 1]}"


def current_month_key() -> str:
    today = date.today()
    return f"{today.year}-{today.month:02d}"
