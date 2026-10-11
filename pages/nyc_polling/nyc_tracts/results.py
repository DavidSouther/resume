"""Typed results of the hypothesis tests. Dataclasses and TypedDicts serialize to the report JSON."""

from dataclasses import asdict, dataclass, field
from typing import NotRequired, TypedDict


class Group(TypedDict):
    group: str
    tracts: int
    outcome: int
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
    favorable_rate_high: float
    favorable_rate_lower: float
    impact_ratio: float | None
    fails_four_fifths: bool
    risk_ratio_out_of_tract: float | None


class BoroughRow(TypedDict):
    borough: str
    groups: list[Group]
    chi_squared: ChiSquared | None


@dataclass
class Hypothesis:
    name: str
    question: str
    chi_squared: ChiSquared
    groups: list[Group] | None = None
    trend: Trend | None = None
    chi_squared_yates: ChiSquared | None = None
    by_borough: list[BoroughRow] | None = None
    mantel_haenszel: MantelHaenszel | None = None
    disparate_impact: DisparateImpact | None = None
    direction_supports_hypothesis: bool = False
    holm_p: float | None = None  # related hypotheses only
    significant_after_holm: bool | None = None

    def to_json(self) -> dict[str, object]:
        """Fields that do not apply to this hypothesis are left out."""
        return {k: v for k, v in asdict(self).items() if v is not None}


class ExcludedSite(TypedDict):
    site: str
    geoid: str


@dataclass
class Report:
    tracts_loaded: int
    tracts_analyzed: int
    tracts_with_income: int
    poll_sites: int
    poll_sites_outside_tracts: int
    sites_in_excluded_layers: dict[str, list[ExcludedSite]]
    outside_sites: list[str]
    tracts_with_site: int
    baseline: Hypothesis
    related: list[Hypothesis] = field(default_factory=list[Hypothesis])

    def to_json(self) -> dict[str, object]:
        return {**asdict(self), "baseline": self.baseline.to_json(), "related": [h.to_json() for h in self.related]}
