"""Tests for the split calculation domain logic."""
from coinco_rep.domain.split import BillInput, PersonInput, compute_split


def make_people(*names_days: tuple[str, int]) -> list[PersonInput]:
    return [PersonInput(id=f"p{i}", name=n, color="#fff", days=d) for i, (n, d) in enumerate(names_days)]


def make_bills(*amounts: float) -> list[BillInput]:
    return [BillInput(id=f"b{i}", category_name="Cat", name="", amount=a, date="2026-06-01") for i, a in enumerate(amounts)]


def make_stays(people: list[PersonInput]) -> dict[str, int]:
    return {p.id: p.days for p in people}


class TestProportionalSplit:
    def test_proportional_by_days(self):
        people = make_people(("Juan", 18), ("Val", 30))
        stays = make_stays(people)
        bills = make_bills(150_000)
        result = compute_split(people, bills, stays)
        assert result.total_days == 48
        assert result.equal_split_warning is False
        juan = next(p for p in result.per_person if p.id == "p0")
        val = next(p for p in result.per_person if p.id == "p1")
        assert abs(juan.pct - 18 / 48) < 1e-9
        assert abs(val.pct - 30 / 48) < 1e-9
        assert abs(juan.amount + val.amount - 150_000) < 0.01

    def test_equal_split_when_no_days(self):
        people = make_people(("A", 0), ("B", 0))
        stays = make_stays(people)
        bills = make_bills(100_000)
        result = compute_split(people, bills, stays)
        assert result.equal_split_warning is True
        assert result.total_days == 0
        for p in result.per_person:
            assert abs(p.pct - 0.5) < 1e-9
            assert abs(p.amount - 50_000) < 0.01

    def test_empty_bills_returns_zero(self):
        people = make_people(("A", 15))
        stays = make_stays(people)
        result = compute_split(people, [], stays)
        assert result.total_amount == 0
        assert result.per_person[0].amount == 0

    def test_single_person_gets_all(self):
        people = make_people(("Solo", 30))
        stays = make_stays(people)
        bills = make_bills(45_000)
        result = compute_split(people, bills, stays)
        assert abs(result.per_person[0].amount - 45_000) < 0.01


class TestRounding:
    def test_exact(self):
        people = make_people(("A", 1), ("B", 2))
        stays = make_stays(people)
        bills = make_bills(10_000)
        result = compute_split(people, bills, stays, rounding="exact")
        a = next(p for p in result.per_person if p.id == "p0")
        assert abs(a.amount - 10_000 / 3) < 0.01

    def test_round100(self):
        people = make_people(("A", 1), ("B", 2))
        stays = make_stays(people)
        bills = make_bills(10_000)
        result = compute_split(people, bills, stays, rounding="round100")
        for p in result.per_person:
            assert p.amount % 100 == 0

    def test_round1000(self):
        people = make_people(("A", 1), ("B", 2))
        stays = make_stays(people)
        bills = make_bills(10_000)
        result = compute_split(people, bills, stays, rounding="round1000")
        for p in result.per_person:
            assert p.amount % 1000 == 0


class TestBillDetails:
    def test_bill_detail_per_person(self):
        people = make_people(("A", 1), ("B", 1))
        stays = make_stays(people)
        bills = make_bills(20_000)
        result = compute_split(people, bills, stays)
        assert len(result.bill_details) == 1
        detail = result.bill_details[0]
        assert len(detail.per_person) == 2
        total_shares = sum(pp["amount"] for pp in detail.per_person)
        assert abs(total_shares - 20_000) < 0.01
