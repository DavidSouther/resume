"""Combined view: every poverty class by every distance band gets its own color, 5 x 4 = 20 cells.

Poverty is lightness (darker is more poverty, as in the Poverty view) and distance is hue, running blue for the nearest band through violet and amber to red for the farthest.
The palette is a search over four hues and a shared lightness ramp, maximizing the closest pair of the 20 colors under normal vision and
protan, deutan, and tritan simulation (OKLab distance x 100, opaque fill: worst pair 6.5 under simulation, 7.1 normal).
"""

from .bands import BANDS
from .poverty import CLASSES, MISSING_COLOR, class_index

# COMBINED[poverty class][distance band]: rows light to dark, columns near to far.
COMBINED: tuple[tuple[str, ...], ...] = (
    ("#baccff", "#e0ddef", "#fbcca7", "#fea7ae"),
    ("#85a2ff", "#bbb3db", "#f79538", "#fd5e78"),
    ("#5473ff", "#9789c9", "#c67525", "#de0d4f"),
    ("#312eff", "#765fb7", "#965718", "#a30437"),
    ("#2000c0", "#544087", "#693a0a", "#6c0021"),
)


def combined_fill(pov_pct: float | None, band: int) -> str:
    """Fill for a poverty rate in percent and a distance band index (see bands.BANDS). No rate is the no data color."""
    i = class_index(pov_pct)
    return MISSING_COLOR if i is None else COMBINED[i][band]


def cells() -> list[tuple[str, str]]:
    """(color, label) for every cell, poverty classes top to bottom and distance bands left to right."""
    return [(COMBINED[i][j], f"{CLASSES[i][2]}, {BANDS[j][2].lower()}") for i in range(len(CLASSES)) for j in range(len(BANDS))]
