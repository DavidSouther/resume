"""Sort tracts into the borough, low population, and zero population layers, as Tract objects."""

from collections.abc import Sequence
from dataclasses import dataclass, field

from ..generic.geo import centroid_of
from ..kernel.domain import Borough, GeoId, Tract
from ..kernel.poverty import CLASSES, MISSING_LABEL, class_index
from .boundaries import TractFeature
from .census import COUNTIES, AcsRow

LOW_POPULATION = 1200
# Census designs a standard tract to hold 1,200 to 8,000 people (optimum 4,000). A tract whose
# poverty universe is under the minimum is not a standard residential tract (institutions, new
# development, mostly non-residential land), and its ACS estimates have very wide margins of error.


@dataclass
class TractLayers:
    by_borough: dict[str, list[Tract]] = field(default_factory=dict[str, list[Tract]])
    low: list[Tract] = field(default_factory=list[Tract])
    zero: list[Tract] = field(default_factory=list[Tract])
    low_report: list[dict[str, object]] = field(default_factory=list[dict[str, object]])
    zero_report: list[dict[str, object]] = field(default_factory=list[dict[str, object]])
    class_counts: dict[int | None, int] = field(default_factory=dict[int | None, int])

    @property
    def mapped(self) -> int:
        return sum(len(v) for v in self.by_borough.values())

    def class_count_report(self) -> dict[str, int]:
        return {(CLASSES[i][2] if i is not None else MISSING_LABEL): n for i, n in self.class_counts.items()}


def _tract(f: TractFeature, borough: str, row: AcsRow | None) -> Tract:
    """A tract with its ACS facts. A tract with no ACS row has no residents on record."""
    geometry = f.geometry()
    if row is None:
        return Tract(GeoId(f.geoid), Borough(borough), None, None, geometry, centroid_of(geometry), population=0.0)
    return Tract(GeoId(f.geoid), Borough(borough), row.pov, row.inc, geometry, centroid_of(geometry), row.pop, row.pov_moe, row.inc_moe)


def build_layers(feats: Sequence[TractFeature], acs: dict[str, AcsRow], low_cutoff: int = LOW_POPULATION) -> TractLayers:
    out = TractLayers()
    for f in feats:
        row = acs.get(f.geoid)
        borough = COUNTIES[f.county]
        if row is None or not row.pop:
            out.zero_report.append({"geoid": f.geoid, "name": f.name, "borough": borough, "reason": "no ACS row" if row is None else "zero population"})
            # No residents: nothing else about the tract is carried.
            geometry = f.geometry()
            out.zero.append(Tract(GeoId(f.geoid), Borough(borough), None, None, geometry, centroid_of(geometry), population=0.0))
            continue
        if row.pop < low_cutoff:
            out.low_report.append({"geoid": f.geoid, "name": f.name, "borough": borough, "population": row.pop, "poverty": row.pov, "income": row.inc, "raw": row.raw})
            out.low.append(_tract(f, borough, row))
            continue
        # Populated enough to map. A missing poverty rate is grey; a missing median income only shows in the card.
        idx = class_index(row.pov)
        out.class_counts[idx] = out.class_counts.get(idx, 0) + 1
        out.by_borough.setdefault(borough, []).append(_tract(f, borough, row))
    return out
