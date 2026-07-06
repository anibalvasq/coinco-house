"""
Render cron entry point — weekly summary email.
Schedule: every Sunday (0 18 * * 0  →  18:00 UTC ≈ 14-15h Chile)
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from coinco_rep.config import settings  # noqa: E402
from coinco_rep.email_reports import send_weekly_summary  # noqa: E402

if __name__ == "__main__":
    if not settings.household_id:
        print("ERROR: HOUSEHOLD_ID not set")
        sys.exit(1)
    sent = send_weekly_summary(settings.household_id)
    if sent:
        print(f"Weekly summary sent to {len(sent)} recipient(s): {', '.join(sent)}")
    else:
        print("No recipients with email registered — nothing sent.")
