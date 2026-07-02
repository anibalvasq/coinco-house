"""
Core split calculation logic — port of computeSplit() from the HTML prototype.

Business rules:
  - Each person's share % = their days / sum of all days in the month.
  - If total registered days == 0, fall back to an equal split and set equal_split_warning=True.
  - Rounding modes: "exact" (default), "round100", "round1000" (CLP has no cents).
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
    Compute the proportional cost split for a given month.

    Args:
        people: All household members.
        bills: All bills for the month.
        stays: Mapping of person_id -> days stayed that month.
        rounding: "exact" | "round100" | "round1000"
    """
    total_amount = sum(b.amount for b in bills)
    total_days = sum(stays.get(p.id, 0) for p in people)
    n = len(people) or 1
    equal_split_warning = total_days == 0

    per_person: list[PersonSplit] = []
    for person in people:
        days = stays.get(person.id, 0)
        pct = days / total_days if total_days > 0 else 1.0 / n
        raw = total_amount * pct
        amount = _apply_rounding(raw, rounding)
        per_person.append(PersonSplit(
            id=person.id,
            name=person.name,
            color=person.color,
            days=days,
            pct=pct,
            amount=amount,
        ))

    bill_details: list[BillSplitDetail] = []
    for bill in bills:
        pp = []
        for ps in per_person:
            raw_share = bill.amount * ps.pct
            share = _apply_rounding(raw_share, rounding)
            pp.append({"person_id": ps.id, "name": ps.name, "amount": share})
        bill_details.append(BillSplitDetail(
            id=bill.id,
            name=bill.name or bill.category_name,
            category_name=bill.category_name,
            amount=bill.amount,
            per_person=pp,
        ))

    return SplitResult(
        total_amount=total_amount,
        total_days=total_days,
        equal_split_warning=equal_split_warning,
        per_person=per_person,
        bill_details=bill_details,
    )
