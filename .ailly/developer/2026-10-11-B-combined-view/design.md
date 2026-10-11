# Design: Combined (poverty by distance) mode for the NYC polling map

*Draft 2026-10-11*

Add a third mode, "Combined", to the `/nyc_polling` mode radio group. It colors each piece with a 3x3 bivariate palette. The "20% and over poverty, over 1 mile" cell is the darkest, most saturated color and gets a white outline, so the 179 pieces that are both high poverty and far stand out. Evidence and rejected options are in [research.md](research.md).

## Breaks

Every combined break is a break in one of the existing modes, so the three legends agree.

| Tier | Poverty (`povertyPct`, percent) | Distance (existing band index from `BANDS`) |
|---|---|---|
| 0 | `< 10` ("Under 10%") = Poverty class 0 | bands 0, 1 ("Under 1/2 mile") |
| 1 | `10 <= p < 20` ("10% to 20%") = class 1 | band 2 ("1/2 to 1 mile") |
| 2 | `>= 20` ("20% and over") = classes 2, 3, 4 | band 3 ("Over 1 mile") |

`cell = 3 * povertyTier + distanceTier` (0 to 8). Cell 8 is the target. Lower bounds are inclusive, matching `class_index` and `band_index` (`value < upper`).

## Palette

Rows are poverty tier and columns are distance tier. The hues continue the other modes: the high poverty arm is red-orange like the Reds, the far arm is purple like the Purples, and they meet in deep wine.

| Poverty \ Distance | Under 1/2 mile | 1/2 to 1 mile | Over 1 mile |
|---|---|---|---|
| Under 10% | 0 `#fff9d3` | 1 `#b7afca` | 2 `#7865b8` |
| 10% to 20% | 3 `#ffa57f` | 4 `#b06e76` | 5 `#693866` |
| 20% and over | 6 `#ee4320` | 7 `#9d1e23` | **8 `#53001a`** |

Pieces per cell: 1100, 932, 446 / 1221, 1173, 390 / 1350, 960, 179 (share of area 11.5, 15.2, 15.1 / 12.5, 14.1, 7.7 / 11.1, 9.2, 3.5 percent).

The palette is a bilinear OKLab interpolation of four corners (OKLCH L, C, h): cell 0 (0.977, 0.050, 100), cell 2 (0.562, 0.126, 292), cell 6 (0.631, 0.213, 33), and cell 8 (0.282, 0.113, 12). It came from a 60,000-candidate search that maximized the worst all-pairs distance (scratch: `bivar.py`, `search3.py`, `final.py`).

**Validation** (OKLab ΔE×100, Machado 2009 severity 1.0, colors composited in sRGB over `#f5f5f5`):

| Check | at fill-opacity 0.7 | **at 0.85 (chosen)** | at 1.0 |
|---|---|---|---|
| All 36 pairs, normal | 8.9 | **11.3** | 13.8 |
| All pairs, protanopia | 7.2 (floor band) | **8.9** | 10.7 |
| All pairs, deuteranopia | 7.5 (floor band) | **9.7** | 11.1 |
| All pairs, tritanopia | 8.6 | **10.8** | 12.7 |
| Legend-adjacent pairs, worst of 4 visions | 9.1 | **12.4** | 13.6 |
| CIEDE2000, all pairs, normal | 14.3 | **16.7** | 17.7 |
| Target cell 8 vs any other cell, worst of 4 visions | 9.1 | **12.4** | |
| Contrast vs `#f5f5f5`, cells 0 to 8 | 1.02 to 6.18 | **1.02, 1.72, 3.38, 1.62, 2.90, 5.60, 3.04, 5.54, 9.86** | |
| vs low population `#7f93b5` (same opacity) | 6.0 (cell 4, deutan) | **7.6** (cell 4, deutan) | |
| vs zero population `#dde5f0` (same opacity) | 4.7 (cell 0, tritan) | **5.4** (cell 0, tritan; 7.5 normal) | |
| vs no data `#b5c3d9` | 2.9 (cell 1) | 3.5 (cell 1) | never drawn: 0 pieces lack poverty |
| vs poll dot `#0288d1` (opaque) | 5.9 (cell 2, protan) | 2.5 (cell 2, protan; 11.5 normal) | |

**Limits stated.** At 0.85 every cell pair clears the CVD target of 8. Three pairings stay below it: cell 0 against zero population tracts (7.5 normal, 5.4 tritan), cell 1 against the unused no-data grey, and cell 2 against the poll dot for protanopes. The mitigations are as follows. Zero population tracts are parks, water, and airports, and both colors mean "nothing to see". The legend lists them separately, and their pop-up shows population 0. Poll dots differ by shape, size, and their white 1.5px ring. Cells 0, 1, and 3 sit under 3:1 against the basemap by design, because they mark the low end. The legend table, pop-up text, and summary line provide the relief channel. The dataviz skill's categorical validator fails this grid on its lightness band, chroma floor, and 15-point normal floor. That outcome is expected for a bivariate ramp, and the skill caps all-pairs forms at 3 categorical series.

## Map layers (client)

- In Combined mode, `fill-color` is `["coalesce", ["get", "combinedFill"], "#cccccc"]` and `fill-opacity` is 0.85. Poverty and Distance modes keep 0.7.
- Insert `pieces-fill`, `pieces-line`, and the new `pieces-target` layer before the basemap's first `symbol` layer (`map.getStyle().layers.find(l => l.type === "symbol")?.id`) so street and place labels stay above the 0.85 fill. Poll dots stay on top.
- Add `pieces-target`, a `line` layer with filter `["==", ["get", "combinedCell"], 8]`, paint `line-color #ffffff` and `line-width ["interpolate", ["linear"], ["zoom"], 10, 1, 14, 2]`. It is visible only in Combined mode. White contrasts 10.75:1 against cell 8 and about 6:1 against its neighbors, cells 5 and 7.
- Add a highlight checkbox, "Only high poverty and far", shown only in Combined mode. When checked, `fill-opacity` becomes `["case", ["==", ["get", "combinedCell"], 8], 0.85, 0.15]`. The checkbox dims the other pieces rather than hiding them, so the reader keeps geographic context.

## Legend (floating card, about 14rem wide)

The legend is a real `<table>` with a `<caption>`. It is not an image, so screen readers get rows and columns.

```
            Distance to assigned site →
            <1/2 mi  1/2 to 1  1+ mi
 20%+      [ 6 ]   [ 7 ]  [■8■]  ← outlined
 10 to 20% [ 3 ]   [ 4 ]  [ 5 ]
 <10%      [ 0 ]   [ 1 ]  [ 2 ]
 ↑ Poverty rate
```

- Each swatch is 1.75rem square with a 2px gap. Swatches are drawn at 0.85 alpha over the card background so they match the map. Row labels take about 3.5rem, and the grid totals about 9.5rem. Tick labels are 0.75rem. The high poverty row is on top, so the target sits top right.
- Cell 8 carries the same white ring as on the map, plus a 1px dark border so the ring shows on the white card. Beside or below the grid, a callout reads "Outlined: 20% and over poverty, more than 1 mile from its early voting site."
- Below the grid are the existing "Low population tract" and "Zero population tract" swatches and the poll site key. "No data" is omitted because no piece lacks a poverty rate.
- Mode radio label: "Combined". Caption: "Poverty and distance".
- Summary line in the card, with numbers computed in Python and carried in `legends`: "179 of 7,751 areas are both 20%+ poverty and over 1 mile away. Over 1 mile: 18% of low poverty areas, 7% of 20%+ poverty areas." This is the text callout. The map shows a small corner, and the sentence states the finding without relying on color.
- Pop-up: add one line, "Combined: 20% and over poverty, over 1 mile", from `legends.combined[cell].label`. The pop-up already lists the poverty rate and the miles.

## Data contract

The values are computed in Python. They are **not** computed client-side from `povertyPct` and `miles`, because `miles` is rounded to 0.01 when parsed from the KML pop-up, and classing the rounded value disagrees with `distanceFill` for 111 pieces. Python already owns `povertyFill` and `distanceFill`, so it should own the combined value too.

Per piece (`kind: "piece"`), the GeoJSON adds:
- `combinedCell`: int, 0 to 8.
- `combinedFill`: hex string from the palette.

Whole tracts (`kind: "tract"`) get `combinedFill` set to their `WHOLE_TRACT_FILL` grey and no `combinedCell`.

The collection adds `legends.combined`. It holds 9 entries in cell order, `{color, label}`, with labels such as `"20% and over poverty, over 1 mile"`. The low and zero population entries follow. Add `summary: {target: 179, total: 7751, farShareByPovertyTier: [0.180, 0.140, 0.072]}`.

Python (`nyc_tracts/combined.py`, imported by `geojson.py`):

```python
POVERTY_TIER_LABELS = ("Under 10%", "10% to 20%", "20% and over")
DISTANCE_TIER_LABELS = ("under 1/2 mile", "1/2 to 1 mile", "over 1 mile")
DISTANCE_TIER_OF_BAND = (0, 0, 1, 2)  # BANDS index -> tier; 1/4 and 1/2 bands merge
COMBINED = ("#fff9d3", "#b7afca", "#7865b8",
            "#ffa57f", "#b06e76", "#693866",
            "#ee4320", "#9d1e23", "#53001a")  # index = 3 * poverty tier + distance tier
TARGET_CELL = 8

def poverty_tier(pov_pct: float) -> int: return min(class_index(pov_pct), 2)
def combined_cell(pov_pct: float, band: int) -> int: return 3 * poverty_tier(pov_pct) + DISTANCE_TIER_OF_BAND[band]
```

In `geojson.features`, get `band` from the KML style color: `BAND_OF_COLOR = {c: i for i, (_, c, _) in enumerate(BANDS)}` applied to `styles[style]`. The longer-term fix is to carry exact miles in KML `ExtendedData`.

Client reference only (do not ship): an equivalent expression on raw numbers, which reproduces the 111 mismatches:
`["at", ["+", ["*", 3, ["step", ["get","povertyPct"], 0, 10, 1, 20, 2]], ["step", ["get","miles"], 0, 0.5, 1, 1, 2]], ["literal", COMBINED]]`.

## Implementation steps

1. Python: add `combined.py` (constants and the two functions). In `geojson.py`, emit `combinedCell` and `combinedFill`, add `legends.combined` and `summary` in `build()`. Regenerate with `nyc_tracts_geojson.py`.
2. Client: extend `MODES` and the fill key map with `combined: "combinedFill"`. Make `setMode` set `fill-opacity` per mode and toggle visibility of `pieces-target` and the highlight checkbox. Add `getStyle` to `MapLike` and insert the layers before the first symbol layer.
3. Client: write `legendGrid(entries)`, which renders the table, the callout, and the summary when the mode is Combined. Add the cell label line to the pop-up card.
4. CSS: add the `.bivariate` table, 1.75rem swatches, a 2px gap, and the ring on the target swatch. Check the layout at 14rem width.
5. Run `uv run run_tests.py`, `npm run check`, and the browser check.

## Feature test

**Python unit test** (`tests/test_combined.py`), asserting cell assignment at edge values:

```python
class CombinedCellTest(unittest.TestCase):
    def test_cell_at_edges(self) -> None:
        cases = {(9.9, 0): 0, (9.9, 1): 0, (0.0, 2): 1, (10.0, 1): 3, (19.9, 3): 5,
                 (20.0, 0): 6, (40.0, 2): 7, (20.0, 3): 8, (99.0, 3): 8}
        for (pov, band), cell in cases.items():
            with self.subTest(pov=pov, band=band):
                self.assertEqual(combined_cell(pov, band), cell)
        self.assertEqual(COMBINED[TARGET_CELL], "#53001a")
```

**Browser check** (playwright-cli, `node scripts/serve.ts --port 8080 --watch`, `http://127.0.0.1:8080/nyc_polling/`, viewport 390x844):
1. Click the "Combined" radio. Check that the legend table has 9 swatches and that the outlined top-right cell and its callout text are present.
2. Evaluate in the page: fetch the pieces GeoJSON and count `combinedCell === 8`. Expect 179 (7,751 pieces total).
3. Check "Only high poverty and far". Take a full-page screenshot and confirm that outlined wine pieces are visible and the rest are dimmed.
4. Switch back to Poverty. Confirm the outline is hidden and the opacity returns to 0.7.
5. Confirm there are no console errors.
