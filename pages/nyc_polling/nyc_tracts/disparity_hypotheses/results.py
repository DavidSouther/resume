"""Typed results of the hypothesis tests. Dataclasses and TypedDicts serialize to the report JSON."""

from dataclasses import asdict, dataclass, field
from typing import NotRequired, TypedDict


class Group(TypedDict):
    group: str
    n: int  # tract districts in the group
    adverse: int  # tract districts with the adverse outcome
    rate: float | None


class ChiSquared(TypedDict):
    chi2: float
    df: int
    p: float
    n: NotRequired[int]
    cramers_v: NotRequired[float]
    min_expected: NotRequired[float]


class Trend(TypedDict):
    z: float
    p_one_sided: float


class MantelHaenszel(TypedDict):
    common_odds_ratio: float
    chi2: float
    df: int
    p: float


class DisparateImpact(TypedDict):
    favorable_rate_high: float  # share of the group with the favorable (not adverse) outcome
    favorable_rate_lower: float
    impact_ratio: float | None
    fails_four_fifths: bool
    risk_ratio_adverse: float | None


class BoroughRow(TypedDict):
    borough: str
    groups: list[Group]
    chi_squared: ChiSquared | None


class NestedTest(TypedDict):
    degrees: str  # "1 to 2": adding the quadratic term to a line
    f: float
    df1: int
    df2: int
    p: float


@dataclass
class PolynomialFit:
    """Least squares polynomial of miles on poverty rate. Coefficients are lowest order first, in z = (x - mean) / scale."""

    degree: int
    coefficients: list[float]
    mean: float
    scale: float
    n: int
    rss: float
    r2: float
    adj_r2: float
    aic: float
    bic: float
    vertex: float | None  # poverty rate where a quadratic turns

    def predict(self, x: float) -> float:
        z = (x - self.mean) / self.scale
        return sum(c * z**k for k, c in enumerate(self.coefficients))


@dataclass
class Regression:
    """Distance to the assigned site against poverty rate, one point per tract district, at each polynomial degree."""

    n: int
    fits: list[PolynomialFit]
    tests: list[NestedTest]  # each degree against the one below
    best_by_bic: int  # degree
    best_by_adj_r2: int


@dataclass
class Hypothesis:
    """One test of one access measure."""

    name: str
    question: str
    chi_squared: ChiSquared
    kind: str = ""  # gradient, two_group, within_borough, or income
    measure: str = ""  # key of the AccessMeasure
    groups: list[Group] | None = None
    trend: Trend | None = None
    chi_squared_yates: ChiSquared | None = None
    by_borough: list[BoroughRow] | None = None
    mantel_haenszel: MantelHaenszel | None = None
    disparate_impact: DisparateImpact | None = None
    direction_supports_hypothesis: bool = False
    holm_p: float | None = None  # every test except the primary one
    significant_after_holm: bool | None = None

    def to_json(self) -> dict[str, object]:
        """Fields that do not apply to this hypothesis are left out."""
        return {k: v for k, v in asdict(self).items() if v is not None}


@dataclass
class ClassAccess:
    """One poverty class: how many tract districts, and for each access measure the share with the adverse outcome and the share of area."""

    group: str
    n: int
    rates: dict[str, float | None]
    area_shares: dict[str, float | None]


@dataclass
class MeasureInfo:
    key: str
    phrase: str
    short: str


@dataclass
class AccessReport:
    """Do higher poverty parts of NYC have differential access to early voting sites? One question, several access measures."""

    tract_districts: int  # with a poverty rate
    tract_districts_with_income: int
    tracts: int
    split_tracts: int  # tracts that span more than one election district
    tracts_without_district: int
    slivers_dropped: int
    sliver_area_share: float
    poll_sites: int  # distinct assigned early voting sites
    poll_sites_outside_tracts: int
    outside_sites: list[str]
    measures: list[MeasureInfo]
    primary_measure: str
    overall_rates: dict[str, float]
    by_class: list[ClassAccess]
    regression: Regression
    primary: Hypothesis  # pre-specified: poverty gradient on the primary measure, not Holm adjusted
    tests: list[Hypothesis] = field(default_factory=list[Hypothesis])  # every other test on every measure, Holm adjusted together

    def to_json(self) -> dict[str, object]:
        return {**asdict(self), "primary": self.primary.to_json(), "tests": [h.to_json() for h in self.tests]}
