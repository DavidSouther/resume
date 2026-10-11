"""Poverty classes shared by the KML writer and the analysis."""

# Fixed breaks (upper bound exclusive), ColorBrewer 5-class Reds, so maps stay comparable across runs.
CLASSES: list[tuple[float, str, str]] = [
    (10.0, "#fee5d9", "Under 10%"),
    (20.0, "#fcae91", "10% to 20%"),
    (30.0, "#fb6a4a", "20% to 30%"),
    (40.0, "#de2d26", "30% to 40%"),
    (float("inf"), "#a50f15", "40% and over"),
]
# Blue tinted greys: lightness orders zero population, no data, low population, and the hue keeps them apart from the reds and purples.
MISSING_COLOR = "#b5c3d9"
LOW_POP_COLOR = "#7f93b5"
ZERO_POP_COLOR = "#dde5f0"
MISSING_LABEL = "No data"
POVERTY_BREAKS = [upper for upper, _, _ in CLASSES[:-1]]
POVERTY_LABELS = [label for _, _, label in CLASSES]


def class_index(pov: float | None) -> int | None:
    """Index into CLASSES for a poverty rate in percent, or None when the rate is missing."""
    if pov is None:
        return None
    for i, (upper, _, _) in enumerate(CLASSES):
        if pov < upper:
            return i
    return len(CLASSES) - 1
