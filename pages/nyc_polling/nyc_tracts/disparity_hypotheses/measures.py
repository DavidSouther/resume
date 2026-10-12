"""Access measures: the ways an early voting site can be out of reach for a tract district.

Every measure answers the same question, whether a tract district has differential access to early voting, on a different scale:
the assigned site is outside the tract, or more than a quarter, half, or whole mile away.
"""

from collections.abc import Callable
from dataclasses import dataclass

from ..kernel.domain import Observation


@dataclass(frozen=True)
class AccessMeasure:
    key: str
    phrase: str  # "assigned to a site ..." clause, used in questions and tables
    short: str  # column heading
    adverse: Callable[[Observation], bool]


def over_miles(miles: float, words: str, short: str) -> AccessMeasure:
    return AccessMeasure(f"over_{miles:g}_mi", f"to a site more than {words} away", short, lambda o: o.miles > miles)


OUT_OF_TRACT = AccessMeasure("out_of_tract", "to a site outside their own tract", "Site in another tract", lambda o: not o.site_in_tract)
QUARTER_MILE = over_miles(0.25, "a quarter mile", "Over 1/4 mile")
MEASURES = (OUT_OF_TRACT, QUARTER_MILE, over_miles(0.5, "half a mile", "Over 1/2 mile"), over_miles(1.0, "a mile", "Over 1 mile"))
PRIMARY = QUARTER_MILE  # a quarter mile is a rule of thumb for a walk that is hard with limited mobility
