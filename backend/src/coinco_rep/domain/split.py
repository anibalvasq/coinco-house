"""
Core split calculation logic.

Business rules:
  - Each bill has a split_mode: "proportional" or "equal".
  - proportional: person's share = their days / total days for that bill.
  - equal: every person pays 1/n of that bill regardless of days.
  - If total registered days == 0 in proportional mode, falls back to equal
    and sets equal_split_warning=True.
  - Rounding modes: "exact" (default), "round100", "round1000" (CLP).
"""
from dataclasses import dataclass, field


@dataclass
class PersonInput:
    id: str
    name: str
    color: str
    days: int


@dataclass
class BillInput:
    id: str
    category_name: str
    name: str
    amount: float
    date: str
    split_mode: str = "proportional"  # "proportional" | "equal"


@dataclass
class PersonSplit:
    id: str
    name: str
    color: str
    days: int
    pct: float
    amount: float


@dataclass
class BillSplitDetail:
    id: str
    name: str
    category_name: str
    amount: float
    split_mode: str
    per_person: list[dict]  # [{person_id, name, amount}]


@dataclass
class SplitResult:
    total_amount: float
    total_days: int
    equal_split_warning: bool
    per_person: list[PersonSplit]
    bill_details: list[BillSplitDetail] = field(default_factory=list)


def _apply_rounding(amount: float, rounding: str) -> float:
    if rounding == "round100":
        return round(amount / 100) * 100
    if rounding == "round1000":
        return round(amount / 1000) * 1000
    return amount


def compute_split(
    people: list[PersonInput],
    bills: list[BillInput],
    stays: dict[str, int],
    rounding: str = "exact",
) -> SplitResult:
    """
    Compute cost split for a month, respecting each bill's split_mode.

    Args:
        people: All household members.
        bills: All bills for the month, each with its own split_mode.
        stays: Mapping of person_id -> days stayed that month.
        rounding: "exact" | "round100" | "round1000"
    """
    total_amount = sum(b.amount for b in bills)
    total_days = sum(stays.get(p.id, 0) for p in people)
    n = len(people) or 1
    equal_split_warning = total_days == 0

    # Proportional pct per person (used for proportional bills and summary display)
    prop_pct: dict[str, float] = {}
    for person in people:
        days = stays.get(person.id, 0)
        prop_pct[person.id] = days / total_days if total_days > 0 else 1.0 / n

    # Accumulate each person's total across all bills
    person_totals: dict[str, float] = {p.id: 0.0 for p in people}

    bill_details: list[BillSplitDetail] = []
    for bill in bills:
        pp = []
        for person in people:
            pct = 1.0 / n if bill.split_mode == "equal" else prop_pct[person.id]
            share = _apply_rounding(bill.amount * pct, rounding)
            person_totals[person.id] += share
            pp.append({"person_id": person.id, "name": person.name, "amount": share})
        bill_details.append(BillSplitDetail(
            id=bill.id,
            name=bill.name or bill.category_name,
            category_name=bill.category_name,
            amount=bill.amount,
            split_mode=bill.split_mode,
            per_person=pp,
        ))

    per_person: list[PersonSplit] = [
        PersonSplit(
            id=p.id,
            name=p.name,
            color=p.color,
            days=stays.get(p.id, 0),
            pct=prop_pct[p.id],
            amount=person_totals[p.id],
        )
        for p in people
    ]

    return SplitResult(
        total_amount=total_amount,
        total_days=total_days,
        equal_split_warning=equal_split_warning,
        per_person=per_person,
        bill_details=bill_details,
    )
