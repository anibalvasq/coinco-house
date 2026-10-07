"""Tests for Web Push notifications (new bill + monthly close-out)."""

import json
from datetime import date
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from pywebpush import WebPushException

from coinco_rep import push
from coinco_rep.api.routes.cron import _is_last_day_of_month
from coinco_rep.auth.service import create_session_token
from coinco_rep.config import settings
from coinco_rep.main import app

HH = "hh-1"


def _sub(person_id: str, n: int = 1) -> dict:
    return {
        "endpoint": f"https://push.example.com/{person_id}/{n}",
        "p256dh": "p256",
        "auth": "auth",
        "person_id": person_id,
        "household_id": HH,
    }


def _keys():
    return patch.multiple(settings, vapid_public_key="pub", vapid_private_key="priv")


class TestSendToSubscriptions:
    def test_noop_without_vapid_keys(self):
        with patch.multiple(settings, vapid_public_key="", vapid_private_key=""):
            with patch("coinco_rep.push.webpush") as wp:
                assert push.send_to_subscriptions([_sub("a")], {"title": "x"}) == 0
                wp.assert_not_called()

    def test_sends_json_payload(self):
        with _keys(), patch("coinco_rep.push.webpush") as wp:
            assert push.send_to_subscriptions([_sub("a"), _sub("b")], {"title": "Hola ñ"}) == 2
            kwargs = wp.call_args.kwargs
            assert json.loads(kwargs["data"]) == {"title": "Hola ñ"}
            assert kwargs["subscription_info"]["keys"] == {"p256dh": "p256", "auth": "auth"}
            assert kwargs["vapid_claims"] == {"sub": settings.vapid_subject}

    def test_gone_subscription_is_deleted(self):
        resp = MagicMock(status_code=410)
        with _keys(), patch(
            "coinco_rep.push.webpush", side_effect=WebPushException("gone", response=resp)
        ), patch("coinco_rep.push.subs_repo.delete_subscription") as delete:
            assert push.send_to_subscriptions([_sub("a")], {"title": "x"}) == 0
            delete.assert_called_once_with("https://push.example.com/a/1")

    def test_other_errors_keep_subscription(self):
        resp = MagicMock(status_code=500)
        with _keys(), patch(
            "coinco_rep.push.webpush", side_effect=WebPushException("boom", response=resp)
        ), patch("coinco_rep.push.subs_repo.delete_subscription") as delete:
            assert push.send_to_subscriptions([_sub("a")], {"title": "x"}) == 0
            delete.assert_not_called()


class TestNotifyNewBill:
    def test_notifies_everyone_including_the_author(self):
        bill = {"id": "b1", "name": "Luz", "amount": 45000, "category_id": "c1"}
        with patch(
            "coinco_rep.push.subs_repo.list_for_household",
            return_value=[_sub("juan"), _sub("vale"), _sub("vale", 2)],
        ), patch(
            "coinco_rep.push.people_repo.get_person", return_value={"name": "Juan"}
        ), patch(
            "coinco_rep.push.cat_repo.list_categories", return_value=[{"id": "c1", "name": "Servicios"}]
        ), patch("coinco_rep.push.send_to_subscriptions", return_value=2) as send:
            push.notify_new_bill(HH, "juan", bill)
            subs, payload = send.call_args.args
            assert {s["person_id"] for s in subs} == {"juan", "vale"}
            assert len(subs) == 3
            assert payload["title"] == "Juan agregó un gasto"
            assert payload["body"] == "Servicios · Luz · $45.000"

    def test_falls_back_to_category_name(self):
        bill = {"id": "b1", "name": "", "amount": 1000, "category_id": "c1"}
        with patch(
            "coinco_rep.push.subs_repo.list_for_household", return_value=[_sub("vale")]
        ), patch(
            "coinco_rep.push.people_repo.get_person", return_value={"name": "Juan"}
        ), patch(
            "coinco_rep.push.cat_repo.list_categories", return_value=[{"id": "c1", "name": "Agua"}]
        ), patch("coinco_rep.push.send_to_subscriptions", return_value=1) as send:
            push.notify_new_bill(HH, "juan", bill)
            assert send.call_args.args[1]["body"].startswith("Agua · ")

    def test_no_devices_sends_nothing(self):
        with patch(
            "coinco_rep.push.subs_repo.list_for_household", return_value=[]
        ), patch("coinco_rep.push.send_to_subscriptions") as send:
            assert push.notify_new_bill(HH, "juan", {"id": "b1", "amount": 1}) == 0
            send.assert_not_called()


class TestMonthlyCloseout:
    def test_each_person_gets_their_own_amount(self):
        preview = [
            {"id": "juan", "name": "Juan", "amount_fmt": "$60.000"},
            {"id": "vale", "name": "Valentina", "amount_fmt": "$40.000"},
        ]
        subs = {"juan": [_sub("juan")], "vale": [_sub("vale")]}
        with _keys(), patch(
            "coinco_rep.push.subs_repo.list_for_person", side_effect=lambda pid, hh: subs[pid]
        ), patch("coinco_rep.push.send_to_subscriptions", return_value=1) as send:
            assert push.notify_monthly_closeout(HH, "2026-10", preview, 100000) == 2
            sent = {c.args[0][0]["person_id"]: c.args[1] for c in send.call_args_list}
            assert "$60.000" in sent["juan"]["body"]
            assert "$40.000" in sent["vale"]["body"]
            assert sent["juan"]["title"] == "Cierre de octubre 2026"

    def test_last_day_of_month(self):
        assert _is_last_day_of_month(date(2026, 10, 31))
        assert not _is_last_day_of_month(date(2026, 10, 30))
        assert _is_last_day_of_month(date(2028, 2, 29))
        assert not _is_last_day_of_month(date(2028, 2, 28))


class TestPushRoutes:
    def _client(self) -> TestClient:
        client = TestClient(app)
        client.cookies.set("session", create_session_token("juan", HH))
        return client

    def test_public_key_reports_disabled(self):
        with patch.multiple(settings, vapid_public_key="", vapid_private_key=""):
            res = TestClient(app).get("/api/v1/push/public-key")
            assert res.json() == {"enabled": False, "public_key": None}

    def test_subscribe_requires_auth(self):
        res = TestClient(app).post(
            "/api/v1/push/subscribe",
            json={"endpoint": "https://x", "keys": {"p256dh": "a", "auth": "b"}},
        )
        assert res.status_code == 401

    def test_subscribe_stores_for_session_person(self):
        with _keys(), patch("coinco_rep.api.routes.push.subs_repo.upsert_subscription") as upsert:
            res = self._client().post(
                "/api/v1/push/subscribe",
                json={"endpoint": "https://push.example.com/x", "keys": {"p256dh": "a", "auth": "b"}},
            )
            assert res.status_code == 204
            upsert.assert_called_once_with(HH, "juan", "https://push.example.com/x", "a", "b")

    def test_subscribe_disabled_returns_503(self):
        with patch.multiple(settings, vapid_public_key="", vapid_private_key=""):
            res = self._client().post(
                "/api/v1/push/subscribe",
                json={"endpoint": "https://push.example.com/x", "keys": {"p256dh": "a", "auth": "b"}},
            )
            assert res.status_code == 503


class TestMonthlyCron:
    def _get(self):
        return TestClient(app).get(
            "/api/v1/cron/monthly", headers={"Authorization": "Bearer cron-secret"}
        )

    def _patch_date(self, d: date):
        fake = MagicMock(wraps=date)
        fake.today.return_value = d
        return patch("coinco_rep.api.routes.cron.date", fake)

    def test_skips_email_and_push_before_last_day(self):
        with patch.multiple(settings, cron_secret="cron-secret", household_id=HH), \
                self._patch_date(date(2026, 10, 30)), \
                patch("coinco_rep.api.routes.cron.send_monthly_closeout") as email, \
                patch("coinco_rep.api.routes.cron.notify_monthly_closeout") as notify:
            res = self._get()
            assert res.json()["status"] == "skipped"
            email.assert_not_called()
            notify.assert_not_called()

    def test_sends_email_and_push_on_last_day(self):
        with patch.multiple(settings, cron_secret="cron-secret", household_id=HH), \
                self._patch_date(date(2026, 10, 31)), \
                patch("coinco_rep.api.routes.cron.compute_month_preview", return_value=([], 0, [], {})), \
                patch("coinco_rep.api.routes.cron.notify_monthly_closeout", return_value=2), \
                patch("coinco_rep.api.routes.cron.send_monthly_closeout", return_value=["a@x.cl"]) as email:
            res = self._get()
            assert res.json() == {
                "status": "ok", "sent_to": ["a@x.cl"], "count": 1, "push_delivered": 2,
            }
            email.assert_called_once_with(HH, "2026-10")


class TestBillLabel:
    def _label(self, bill, categories=({"id": "c1", "name": "Luz"},)):
        with patch("coinco_rep.push.cat_repo.list_categories", return_value=list(categories)):
            return push._bill_label(HH, bill)

    def test_category_and_name(self):
        assert self._label({"category_id": "c1", "name": "Factura julio"}) == "Luz · Factura julio"

    def test_category_only(self):
        assert self._label({"category_id": "c1", "name": ""}) == "Luz"

    def test_name_equal_to_category_is_not_repeated(self):
        assert self._label({"category_id": "c1", "name": "luz"}) == "Luz"

    def test_name_without_category(self):
        assert self._label({"category_id": None, "name": "Gas"}) == "Gas"

    def test_nothing(self):
        assert self._label({"category_id": None, "name": ""}) == "Gasto"


class TestNotifyBillChanges:
    BEFORE = {
        "id": "b1", "name": "Luz", "amount": 45000.0, "category_id": "c1", "date": "2026-10-05",
        "note": "", "split_mode": "proportional", "fixed": False,
    }

    def _run(self, fn, *args):
        with patch(
            "coinco_rep.push.subs_repo.list_for_household", return_value=[_sub("juan"), _sub("vale")]
        ), patch(
            "coinco_rep.push.people_repo.get_person", return_value={"name": "Juan"}
        ), patch(
            "coinco_rep.push.cat_repo.list_categories", return_value=[{"id": "c1", "name": "Servicios"}]
        ), patch("coinco_rep.push.send_to_subscriptions", return_value=1) as send:
            fn(HH, "juan", *args)
            return send

    def test_edit_shows_amount_change(self):
        after = {**self.BEFORE, "amount": "50000.00"}
        send = self._run(push.notify_bill_updated, self.BEFORE, after)
        subs, payload = send.call_args.args
        assert {s["person_id"] for s in subs} == {"juan", "vale"}
        assert payload["title"] == "Juan editó un gasto"
        assert payload["body"] == "Servicios · Luz · $45.000 → $50.000"

    def test_edit_other_field_shows_current_amount(self):
        after = {**self.BEFORE, "name": "Luz octubre"}
        send = self._run(push.notify_bill_updated, self.BEFORE, after)
        assert send.call_args.args[1]["body"] == "Servicios · Luz octubre · $45.000"

    def test_saving_unchanged_bill_sends_nothing(self):
        after = {**self.BEFORE, "amount": "45000.00"}
        send = self._run(push.notify_bill_updated, self.BEFORE, after)
        send.assert_not_called()

    def test_delete(self):
        send = self._run(push.notify_bill_deleted, self.BEFORE)
        payload = send.call_args.args[1]
        assert payload["title"] == "Juan eliminó un gasto"
        assert payload["body"] == "Servicios · Luz · $45.000"


class TestBillRoutesNotify:
    def _client(self) -> TestClient:
        client = TestClient(app)
        client.cookies.set("session", create_session_token("juan", HH))
        return client

    def test_delete_notifies_with_bill_before_deletion(self):
        bill = {"id": "b1", "name": "Luz", "amount": 1000}
        with patch("coinco_rep.api.routes.bills.repo.get_bill", return_value=bill), \
                patch("coinco_rep.api.routes.bills.repo.delete_bill") as delete, \
                patch("coinco_rep.api.routes.bills.notify_bill_deleted") as notify:
            res = self._client().delete("/api/v1/bills/b1")
            assert res.status_code == 204
            delete.assert_called_once_with("b1", HH)
            notify.assert_called_once_with(HH, "juan", bill)

    def test_update_succeeds_even_if_notification_fails(self):
        with patch("coinco_rep.api.routes.bills.repo.get_bill", side_effect=Exception("db")), \
                patch("coinco_rep.api.routes.bills.repo.update_bill", return_value={"id": "b1"}), \
                patch("coinco_rep.api.routes.bills.notify_bill_updated", side_effect=Exception("push")):
            res = self._client().patch("/api/v1/bills/b1", json={"amount": 2000})
            assert res.status_code == 200
            assert res.json() == {"id": "b1"}
