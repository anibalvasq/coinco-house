"""
Email reports for CoinCo House.

- Weekly (every Sunday): month summary + line chart of daily accumulated spending.
- Monthly (last day): close-out email with what each person owes.

Charts are generated as PNG images by QuickChart.io (free, no auth).
Emails are sent via Resend.
"""
import json
import urllib.parse
from collections import defaultdict
from datetime import date

import resend

from coinco_rep.config import settings
from coinco_rep.domain.formatting import fmt_clp, month_label
from coinco_rep.domain.split import BillInput, PersonInput, compute_split
from coinco_rep.repositories import bills as bills_repo
from coinco_rep.repositories import categories as cat_repo
from coinco_rep.repositories import households as hh_repo
from coinco_rep.repositories import people as people_repo
from coinco_rep.repositories import stays as stays_repo

# ── Helpers ─────────────────────────────────────────────────────────────────

MONTH_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"]


def _current_month_key() -> str:
    today = date.today()
    return f"{today.year}-{today.month:02d}"


def _quickchart_line_url(labels: list[str], values: list[float]) -> str:
    """Return a QuickChart.io PNG URL for a cumulative spending line chart."""
    chart = {
        "type": "line",
        "data": {
            "labels": labels,
            "datasets": [{
                "data": values,
                "fill": True,
                "backgroundColor": "rgba(41,182,246,0.12)",
                "borderColor": "#29b6f6",
                "borderWidth": 2,
                "pointRadius": 3,
                "pointBackgroundColor": "#29b6f6",
                "tension": 0.4,
            }],
        },
        "options": {
            "plugins": {"legend": {"display": False}},
            "scales": {
                "y": {
                    "ticks": {
                        "callback": "function(v){return '$'+(v).toLocaleString('es-CL')}",
                        "maxTicksLimit": 5,
                    },
                    "grid": {"color": "rgba(0,0,0,0.05)"},
                },
                "x": {"grid": {"display": False}},
            },
        },
    }
    encoded = urllib.parse.quote(json.dumps(chart, separators=(",", ":")))
    return f"https://quickchart.io/chart?w=500&h=200&bkg=white&c={encoded}"


def _daily_cumulative(bills: list[dict]) -> tuple[list[str], list[float]]:
    """Group bills by date, return sorted labels ('5 jul') and cumulative amounts."""
    daily: dict[str, float] = defaultdict(float)
    for b in bills:
        daily[b["date"]] += float(b["amount"])
    if not daily:
        return [], []
    labels, cumulative, total = [], [], 0.0
    for d in sorted(daily.keys()):
        total += daily[d]
        day = str(int(d[8:]))
        mon = MONTH_SHORT[int(d[5:7]) - 1]
        labels.append(f"{day} {mon}")
        cumulative.append(round(total))
    return labels, cumulative


# ── Split calculation ────────────────────────────────────────────────────────

def _compute_preview(household_id: str, month_key: str) -> tuple[list[dict], float, list[dict], dict]:
    """Return (split_preview, total, raw_bills, categories)."""
    all_people = people_repo.list_people(household_id)
    raw_bills = bills_repo.list_bills(household_id, month_key)
    stays = stays_repo.get_stays(household_id, month_key)
    categories = {c["id"]: c for c in cat_repo.list_categories(household_id)}
    household = hh_repo.get_household(household_id) or {}
    rounding = household.get("split_rounding", "exact")

    people = [
        PersonInput(id=p["id"], name=p["name"], color=p["color"], days=stays.get(p["id"], 0))
        for p in all_people
    ]
    bills = [
        BillInput(
            id=b["id"],
            category_name=categories.get(b["category_id"], {}).get("name", ""),
            name=b["name"],
            amount=float(b["amount"]),
            date=b["date"],
            split_mode=b.get("split_mode", "proportional"),
        )
        for b in raw_bills
    ]

    split = compute_split(people, bills, stays, rounding)
    total = sum(float(b["amount"]) for b in raw_bills)
    n = len(people) or 1

    preview = [
        {
            "name": p.name,
            "color": p.color,
            "amount": p.amount,
            "amount_fmt": fmt_clp(p.amount),
            "pct": round((p.amount / total * 100) if total > 0 else 100 / n, 1),
        }
        for p in split.per_person
    ]
    return preview, total, raw_bills, categories


# ── HTML templates ───────────────────────────────────────────────────────────

_STYLE = """
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f0;margin:0;padding:0}
  .wrap{max-width:520px;margin:0 auto;padding:24px 16px}
  .card{background:#fff;border-radius:16px;padding:24px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.08)}
  .hdr{text-align:center;margin-bottom:24px}
  .logo{font-size:22px;font-weight:800;color:#1a1a2e;letter-spacing:-.5px}
  .sub{font-size:13px;color:#888;margin-top:4px}
  h2{font-size:15px;font-weight:700;color:#1a1a2e;margin:0 0 14px}
  .tot-lbl{font-size:13px;color:#888;margin-bottom:4px}
  .tot-amt{font-size:32px;font-weight:800;color:#1a1a2e;letter-spacing:-1px}
  .pr{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #f0f0ec}
  .pr:last-child{border-bottom:none}
  .dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:8px;flex-shrink:0}
  .pname{font-size:14px;font-weight:600;color:#1a1a2e}
  .ppct{font-size:12px;color:#888;margin-left:4px}
  .pamt{font-size:15px;font-weight:700;color:#1a1a2e}
  .br{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f0f0ec;font-size:13px}
  .br:last-child{border-bottom:none}
  .beq{background:#d1fae5;color:#065f46;font-size:10px;font-weight:700;border-radius:4px;padding:2px 5px;margin-left:5px}
  .ftr{text-align:center;font-size:11px;color:#bbb;margin-top:16px}
  img{max-width:100%;border-radius:8px;display:block}
</style>"""


def _html_weekly(
    month_key: str,
    total: float,
    preview: list[dict],
    chart_url: str,
    raw_bills: list[dict],
    categories: dict,
) -> str:
    mon = month_label(month_key)

    person_rows = "".join(f"""
      <div class="pr">
        <span><span class="dot" style="background:{p['color']}"></span>
          <span class="pname">{p['name']}</span>
          <span class="ppct">{p['pct']}%</span>
        </span>
        <span class="pamt">{p['amount_fmt']}</span>
      </div>""" for p in preview)

    bill_rows = "".join(f"""
      <div class="br">
        <span style="color:#333">
          {b.get('name') or categories.get(b['category_id'], {}).get('name', '?')}
          {'<span class="beq">⚖️ 50/50</span>' if b.get('split_mode') == 'equal' else ''}
        </span>
        <span style="font-weight:600">{fmt_clp(float(b['amount']))}</span>
      </div>""" for b in raw_bills) or '<div style="color:#888;font-size:13px">Sin cuentas aún</div>'

    chart_block = f"""
      <div class="card">
        <h2>Evolución del gasto</h2>
        <img src="{chart_url}" alt="Gasto acumulado">
      </div>""" if chart_url else ""

    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">{_STYLE}</head><body>
<div class="wrap">
  <div class="hdr"><div class="logo">🏠 CoinCo</div><div class="sub">Resumen semanal · {mon}</div></div>

  <div class="card">
    <div class="tot-lbl">Total gastado este mes</div>
    <div class="tot-amt">{fmt_clp(total)}</div>
  </div>

  <div class="card"><h2>Reparto</h2>{person_rows}</div>

  {chart_block}

  <div class="card"><h2>Cuentas del mes</h2>{bill_rows}</div>

  <div class="ftr">CoinCo House · resumen automático semanal</div>
</div></body></html>"""


def _html_monthly(month_key: str, total: float, preview: list[dict], recipient_name: str) -> str:
    mon = month_label(month_key)
    own = next((p for p in preview if p["name"] == recipient_name), None)

    person_rows = "".join(f"""
      <div class="pr">
        <span><span class="dot" style="background:{p['color']}"></span>
          <span class="pname">{p['name']}</span>
          <span class="ppct">{p['pct']}%</span>
        </span>
        <span class="pamt">{p['amount_fmt']}</span>
      </div>""" for p in preview)

    hero = f"""
      <div class="card" style="background:oklch(0.95 0.05 250);border:2px solid oklch(0.80 0.10 250)">
        <div class="tot-lbl">Tu parte este mes</div>
        <div class="tot-amt" style="color:oklch(0.35 0.15 250)">{own['amount_fmt'] if own else fmt_clp(total)}</div>
      </div>""" if own else ""

    return f"""<!DOCTYPE html><html><head><meta charset="utf-8">{_STYLE}</head><body>
<div class="wrap">
  <div class="hdr"><div class="logo">🏠 CoinCo</div><div class="sub">Cierre de mes · {mon}</div></div>

  {hero}

  <div class="card">
    <div class="tot-lbl">Total del mes</div>
    <div class="tot-amt">{fmt_clp(total)}</div>
  </div>

  <div class="card"><h2>Lo que debe pagar cada uno</h2>{person_rows}</div>

  <div class="ftr">CoinCo House · cierre de {mon}</div>
</div></body></html>"""


# ── Public API ───────────────────────────────────────────────────────────────

def send_weekly_summary(household_id: str, month_key: str | None = None) -> list[str]:
    """Send weekly summary email to all household members with an email address."""
    resend.api_key = settings.resend_api_key
    if not resend.api_key:
        raise ValueError("RESEND_API_KEY not set")

    month_key = month_key or _current_month_key()
    preview, total, raw_bills, categories = _compute_preview(household_id, month_key)

    labels, values = _daily_cumulative(raw_bills)
    chart_url = _quickchart_line_url(labels, values) if labels else ""

    html = _html_weekly(month_key, total, preview, chart_url, raw_bills, categories)
    subject = f"Resumen semanal · {month_label(month_key)} · {fmt_clp(total)}"

    all_people = people_repo.list_people(household_id)
    recipients = [p["email"] for p in all_people if p.get("email")]
    sent: list[str] = []
    for email in recipients:
        resend.Emails.send({
            "from": settings.from_email,
            "to": [email],
            "subject": subject,
            "html": html,
        })
        sent.append(email)
    return sent


def send_monthly_closeout(household_id: str, month_key: str | None = None) -> list[str]:
    """Send month-end close-out email to all household members with an email address."""
    resend.api_key = settings.resend_api_key
    if not resend.api_key:
        raise ValueError("RESEND_API_KEY not set")

    month_key = month_key or _current_month_key()
    preview, total, _, _ = _compute_preview(household_id, month_key)

    all_people = people_repo.list_people(household_id)
    recipients = [(p["email"], p["name"]) for p in all_people if p.get("email")]
    sent: list[str] = []
    for email, name in recipients:
        own = next((p for p in preview if p["name"] == name), None)
        subject = (
            f"Cierre de {month_label(month_key)} · "
            f"Tu parte: {own['amount_fmt']}" if own else f"Cierre de {month_label(month_key)}"
        )
        html = _html_monthly(month_key, total, preview, name)
        resend.Emails.send({
            "from": settings.from_email,
            "to": [email],
            "subject": subject,
            "html": html,
        })
        sent.append(email)
    return sent
