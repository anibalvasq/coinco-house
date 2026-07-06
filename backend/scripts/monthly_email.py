"""
Render cron entry point — monthly close-out email.
Schedule: every day at 20:00 UTC (0 20 * * *).
The script self-exits if today is NOT the last day of the month,
because Render cron doesn't support the 'L' notation.
"""
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from coinco_rep.config import settings  # noqa: E402
from coinco_rep.email_reports import send_monthly_closeout  # noqa: E402


def _is_last_day() -> bool:
    today = date.today()
    try:
        date(today.year, today.month, today.day + 1)
        return False
    except ValueError:
        return True


if __name__ == "__main__":
    if not _is_last_day():
        print(f"Today ({date.today()}) is not the last day of the month — skipping.")
        sys.exit(0)

    if not settings.household_id:
        print("ERROR: HOUSEHOLD_ID not set")
        sys.exit(1)

    sent = send_monthly_closeout(settings.household_id)
    if sent:
        print(f"Monthly close-out sent to {len(sent)} recipient(s): {', '.join(sent)}")
    else:
        print("No recipients with email registered — nothing sent.")
