"""Render the disparate impact report from analysis results with a jinja2 template."""

from dataclasses import dataclass
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined

from ..disparity_hypotheses.hypotheses import ALPHA, HIGH_POVERTY
from ..disparity_hypotheses.results import AccessReport, Group, Hypothesis, MeasureInfo

TEMPLATES = Path(__file__).parent / "templates"


def fmt_p(p: float) -> str:
    return "<0.0001" if p < 1e-4 else f"{p:.4f}"


def pct(v: float) -> str:
    return f"{v:.1%}"


def direction(h: Hypothesis) -> str:
    return "as hypothesized" if h.direction_supports_hypothesis else "opposite"


@dataclass(frozen=True)
class Summary:
    """Narrative facts for the executive summary; the template only formats them."""

    supported: bool
    opposite_and_significant: bool
    primary_measure: MeasureInfo
    first: Group
    last: Group
    opposite: list[str]
    toward: list[str]
    not_significant: int


def summarize(report: AccessReport) -> Summary:
    b = report.primary
    assert b.groups is not None and b.trend is not None
    measure = next(m for m in report.measures if m.key == report.primary_measure)
    return Summary(
        supported=b.direction_supports_hypothesis and b.trend["p_one_sided"] < ALPHA,
        opposite_and_significant=b.chi_squared["p"] < ALPHA and not b.direction_supports_hypothesis,
        primary_measure=measure,
        first=b.groups[0],
        last=b.groups[-1],
        opposite=[h.name for h in report.tests if not h.direction_supports_hypothesis and h.significant_after_holm],
        toward=[h.name for h in report.tests if h.direction_supports_hypothesis and h.significant_after_holm],
        not_significant=sum(1 for h in report.tests if not h.significant_after_holm),
    )


def environment() -> Environment:
    env = Environment(loader=FileSystemLoader(TEMPLATES), undefined=StrictUndefined, trim_blocks=True, lstrip_blocks=True, keep_trailing_newline=True)
    env.filters["p"] = fmt_p
    env.filters["pct"] = pct
    env.filters["direction"] = direction
    return env


def render_md(report: AccessReport) -> str:
    return environment().get_template("access.md.j2").render(r=report, s=summarize(report), ALPHA=ALPHA, HIGH_POVERTY=HIGH_POVERTY)
