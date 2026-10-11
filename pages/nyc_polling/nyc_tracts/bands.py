"""Distance bands from a piece of a tract to its assigned early voting site."""

# Upper bound in miles (exclusive), ColorBrewer 4-class Purples: darker is farther from the assigned site.
BANDS: list[tuple[float, str, str]] = [
    (0.25, "#f2f0f7", "Within 1/4 mile"),
    (0.5, "#cbc9e2", "1/4 to 1/2 mile"),
    (1.0, "#9e9ac8", "1/2 to 1 mile"),
    (float("inf"), "#6a51a3", "Over 1 mile"),
]


def band_index(miles: float) -> int:
    return next(i for i, (upper, _, _) in enumerate(BANDS) if miles < upper)
