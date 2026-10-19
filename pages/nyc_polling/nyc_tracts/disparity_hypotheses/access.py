"""Do higher poverty parts of NYC have differential access to early voting sites?

The unit of analysis is the tract district (geography/tract_district.py): a tract within an election district, which BOE assigns to exactly one early voting site.
Each tract district keeps its tract's poverty rate and income. Access is measured several ways (measures.py), and one report answers the one question.
"""

from collections.abc import Mapping, Sequence

from ..geography.tract_district import TractDistrict, TractDistricts
from ..kernel.domain import Observation, Site, Tract
from ..kernel.poverty import POVERTY_LABELS, class_index
from .hypotheses import poverty_regression, run_tests, site_tracts
from .measures import MEASURES, PRIMARY, AccessMeasure
from .results import AccessReport, ClassAccess, MeasureInfo


def distinct_sites(site_of: Mapping[int, Site]) -> list[Site]:
    """The early voting sites in use, one per address, in a stable order."""
    return sorted({s.name: s for s in site_of.values()}.values(), key=lambda s: s.name)


def _rate(group: Sequence[Observation], m: AccessMeasure) -> float | None:
    return sum(1 for o in group if m.adverse(o)) / len(group) if group else None


def _area_share(group: Sequence[TractDistrict], m: AccessMeasure) -> float | None:
    area = sum(s.geometry.area for s in group)
    return sum(s.geometry.area for s in group if m.adverse(s.observation())) / area if area else None


def by_class(subs: Sequence[TractDistrict], measures: Sequence[AccessMeasure]) -> list[ClassAccess]:
    rows: list[ClassAccess] = []
    for idx, label in enumerate(POVERTY_LABELS):
        group = [s for s in subs if s.tract.poverty is not None and class_index(s.tract.poverty) == idx]
        obs = [s.observation() for s in group]
        rows.append(ClassAccess(label, len(group), {m.key: _rate(obs, m) for m in measures}, {m.key: _area_share(group, m) for m in measures}))
    return rows


def analyze_access(tracts: Sequence[Tract], divided: TractDistricts, sites: Sequence[Site], measures: Sequence[AccessMeasure] = MEASURES, primary: AccessMeasure = PRIMARY) -> AccessReport:
    """`sites` are the early voting sites in use (see distinct_sites); `tracts` are the analyzed tracts the tract districts were cut from."""
    subs = divided.tract_districts
    obs = [s.observation() for s in subs]
    lead, rest = run_tests(obs, measures, primary)
    pov = [o for o in obs if o.tract.poverty is not None]
    outside = [s for s, t in zip(sites, site_tracts(tracts, sites), strict=True) if t is None]
    per_tract: dict[str, int] = {}
    for s in subs:
        per_tract[s.tract.geoid] = per_tract.get(s.tract.geoid, 0) + 1
    return AccessReport(
        tract_districts=len(pov),
        tract_districts_with_income=sum(1 for o in pov if o.tract.income is not None),
        tracts=len(per_tract),
        split_tracts=sum(1 for n in per_tract.values() if n > 1),
        tracts_without_district=len(divided.uncovered),
        slivers_dropped=divided.slivers_dropped,
        sliver_area_share=divided.sliver_area_share,
        poll_sites=len(sites),
        poll_sites_outside_tracts=len(outside),
        outside_sites=[s.name for s in outside],
        measures=[MeasureInfo(m.key, m.phrase, m.short) for m in measures],
        primary_measure=primary.key,
        overall_rates={m.key: r for m in measures if (r := _rate(pov, m)) is not None},
        by_class=by_class([s for s in subs if s.tract.poverty is not None], measures),
        regression=poverty_regression(obs),
        primary=lead,
        tests=rest,
    )
