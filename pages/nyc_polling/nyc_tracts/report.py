"""Render the disparate impact report from analysis results with a jinja2 template."""

from dataclasses import dataclass
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined

from .hypotheses import ALPHA, HIGH_POVERTY
from .results import BoroughRow, Group, Hypothesis, Report

TEMPLATES = Path(__file__).parent / "templates"


def fmt_p(p: float) -> str:
    return "<0.0001" if p < 1e-4 else f"{p:.4f}"


def pct(v: float) -> str:
    return f"{v:.1%}"


def direction(h: Hypothesis) -> str:
    return "as hypothesized" if h.direction_supports_hypothesis else "opposite"


def excluded_sites_text(report: Report) -> str:
    parts = [f"{len(v)} in {k} tracts" for k, v in report.sites_in_excluded_layers.items()]
    if report.poll_sites_outside_tracts:
        parts.append(f"{report.poll_sites_outside_tracts} in no tract")
    return ", ".join(parts) + "; none of these serve an analyzed tract" if parts else "all inside analyzed tracts"


@dataclass(frozen=True)
class Summary:
    """Narrative facts for the executive summary; the template only formats them."""

    supported: bool
    opposite_and_significant: bool
    first: Group
    last: Group
    overall_out_rate: float
    opposite: list[str]
    toward: list[str]
    distance_farther: bool
    manhattan: BoroughRow
    excluded_sites: str


def summarize(report: Report) -> Summary:
    b = report.baseline
    rel = {h.name.split()[0]: h for h in report.related}
    assert b.groups is not None and b.trend is not None and rel["H2"].by_borough is not None
    manhattan = next(bb for bb in rel["H2"].by_borough if bb["borough"] == "Manhattan")
    return Summary(
        supported=b.direction_supports_hypothesis and b.trend["p_one_sided"] < ALPHA,
        opposite_and_significant=b.chi_squared["p"] < ALPHA and not b.direction_supports_hypothesis,
        first=b.groups[0],
        last=b.groups[-1],
        overall_out_rate=1 - report.tracts_with_site / report.tracts_analyzed,
        opposite=[k for k, h in rel.items() if not h.direction_supports_hypothesis and h.significant_after_holm],
        toward=[k for k, h in rel.items() if h.direction_supports_hypothesis and h.significant_after_holm],
        distance_farther=rel["H3"].direction_supports_hypothesis,
        manhattan=manhattan,
        excluded_sites=excluded_sites_text(report),
    )


def environment() -> Environment:
    env = Environment(loader=FileSystemLoader(TEMPLATES), undefined=StrictUndefined, trim_blocks=True, lstrip_blocks=True, keep_trailing_newline=True)
    env.filters["p"] = fmt_p
    env.filters["pct"] = pct
    env.filters["direction"] = direction
    return env


def render_md(report: Report) -> str:
    return environment().get_template("disparity.md.j2").render(r=report, s=summarize(report), ALPHA=ALPHA, HIGH_POVERTY=HIGH_POVERTY)
