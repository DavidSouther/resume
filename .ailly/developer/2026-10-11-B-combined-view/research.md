# Research: combined poverty by distance view for the NYC polling map

*Draft 2026-10-11*

## Topic and Intent

> Add a third combined view that finds a way to clearly color distance x poverty

The map at `/nyc_polling` (`pages/nyc_polling/page.ts`, `src/components/nyc_polling/client.ts`) has two fill modes over 7,751 tract by election district pieces: Poverty (5-class Reds) and Distance (4-class Purples). Readers must toggle between them to answer the analysis question, "do higher poverty tracts get assigned early voting sites farther away?" The intent is one mode where pieces that are both high poverty and far from their assigned site stand out, legible to a general public audience on a phone, over a light basemap, at the existing fill opacity or close to it.

## Search/Expand

**Bivariate choropleth practice.**
- Stevens [1] builds a 3x3 grid by multiplying two 3-step single-hue ramps. He caps at 3x3 because n classes per variable give n² colors and 9 is the usual ceiling for distinguishable classes. He advises legend labels by rank rather than decimals, and making the "both high" corner the most salient cell (raise its saturation, pull the center toward it). His palettes are the defaults in Observable's D3 and Plot bivariate examples [16].
- Trumbo [2] gives the design principles: each variable's order must be visible, rows and columns must separate, and the diagonal carries the relationship. Strode et al. [8] operationalize Trumbo as "focal models" (direct, inverse, range-within): the palette should be chosen for the relationship the map is meant to expose. Here the focus is one corner (high poverty AND far), which is the "range within" or corner focal model, not a correlation diagonal.
- Wainer and Francolini [3] tested the Census Bureau's 1970s Urban Atlas 4x4 (16 color) two-variable maps and found readers struggled to decode them. That study is the main empirical warning against 4x4. Olson [4] and Eyton [5] respond with ordered, complementary-hue designs that are readable when the scheme is logical and the legend is a grid.
- Leonowicz [7]: two-variable choropleths beat paired one-variable maps for reading relationships, and are understood "if properly designed... and [with] reduction of the number of classes." Students found them slightly harder but more interesting.
- Elmer [6] (UW-Madison, 55 participants, 8 bivariate map types): the bivariate choropleth had the highest accuracy (99.1%) and was rated most visually appealing (5.7/7); shaded texture had the lowest accuracy (92.7%) and was least liked (2.6/7); choropleth with graduated symbols was rated easiest to read. Value-by-alpha was tested and is described as asymmetric: hue discrimination falls as transparency rises.
- Teuling et al. [11] build bivariate maps by interpolating four corner colors in a perceptual space; that is the construction used below (bilinear OKLab [19] interpolation of four corners).
- Brewer [12] sets the hue rules (sequential = lightness order, avoid red/green pairings for CVD); Brewer and Suchan [13] used two-variable maps for a general public Census atlas. Datawrapper's bivariate example [17] pairs the map with a scatter plot and uses a 3x3 grid.
- Legibility of classes: accuracy rises with CIEDE2000 distance between classes, with steps of ΔE00 8 to 10 clearly better than 2 to 6 [18]. CVD simulation uses Machado et al. 2009 at severity 1.0 [14], matching the repo's dataviz skill thresholds (OKLab ΔE×100 target 8, floor 6 with secondary encoding).
- "Eve Pitts" could not be verified as an author on bivariate color. The closest classic name is J. Ronald Eyton [5]. Nothing below depends on it.
- No NYT bivariate example was verified in this pass.

**Alternatives weighed for this data and audience.**

| Option | For | Against here | Verdict |
|---|---|---|---|
| 3x3 bivariate grid | Best accuracy in [6]; one map answers the question; corner can be made salient [1] | Needs a legend grid; colors fade at 0.7 opacity | **Chosen** |
| 4x4 or 5x4 grid (existing breaks) | Reuses all current classes | 16 to 20 colors; [3] warns; 3 cells under 1% of pieces (36, 40, 54); cannot reach ΔE 8 at 0.7 opacity even for 9 | Rejected |
| 2x2 (20%+ and over 1 mile) | Simplest | Hides the gradient | Kept as a highlight filter |
| Single composite score, one ramp | Mobile friendly, one legend | Needs an arbitrary weight; a dark piece could be poor-but-near or rich-but-far | Rejected; the binary composite survives as the filter |
| Poverty fill plus hatch for distance | Separable [10] | MapLibre `fill-pattern` needs sprites; hatch aliases on small pieces at city zoom; texture was least accurate and least liked [6] | Rejected |
| Small multiples | Separable | Two maps do not fit a phone; the mode toggle already is a temporal small multiple | Already present |
| Diverging scheme | | Neither variable has a meaningful midpoint | Rejected |
| Poverty hue plus outline width for distance | | 0.5px outlines on 7,751 pieces are unreadable at zoom 10 to 12 | Rejected |
| Value-by-alpha [9] (poverty hue, distance as opacity) | Keeps the Reds | Over a light basemap, alpha becomes lightness, which is already the Reds' poverty channel: a pale piece could be low poverty or near; designed for equalizing magnitude, not for a second ratio | Rejected |

**Joint distribution (measured from `public/nyc_polling/nyc_assignment.geojson`, 7,751 pieces, 237.6 sq mi).** Scratch script: `scratchpad/joint.py`.

Existing breaks, 5 poverty classes by 4 distance bands, pieces (share of pieces, share of area):

| Poverty \ miles | under 1/4 | 1/4 to 1/2 | 1/2 to 1 | over 1 |
|---|---:|---:|---:|---:|
| under 10% | 343 (4.4, 3.3) | 738 (9.5, 7.9) | 948 (12.2, 15.4) | 449 (5.8, 15.3) |
| 10 to 20% | 381 (4.9, 3.9) | 821 (10.6, 8.4) | 1186 (15.3, 14.2) | 396 (5.1, 7.9) |
| 20 to 30% | 225 (2.9, 1.9) | 465 (6.0, 3.9) | 526 (6.8, 5.3) | 106 (1.4, 2.3) |
| 30 to 40% | 174 (2.2, 1.4) | 301 (3.9, 2.3) | 269 (3.5, 2.5) | 36 (0.5, 0.4) |
| 40% and over | 54 (0.7, 0.5) | 113 (1.5, 0.9) | 180 (2.3, 1.6) | 40 (0.5, 0.9) |

Three of 20 cells hold under 1% of pieces, and the high poverty, far corner is fragmented across three near-empty cells.

Collapsed to 3x3 (poverty under 10 / 10 to 20 / 20 and over; distance under 1/2 / 1/2 to 1 / over 1 mile, tiers taken from the existing distance band so they match Distance mode exactly):

| Poverty \ miles | under 1/2 | 1/2 to 1 | over 1 |
|---|---:|---:|---:|
| under 10% | 1100 (14.2, 11.5) | 932 (12.0, 15.2) | 446 (5.8, 15.1) |
| 10 to 20% | 1221 (15.8, 12.5) | 1173 (15.1, 14.1) | 390 (5.0, 7.7) |
| 20% and over | 1350 (17.4, 11.1) | 960 (12.4, 9.2) | **179 (2.3, 3.5)** |

No cell is near empty (minimum 179). Data terciles are 10.2 and 19.6 percent poverty (tract level 10.2 and 19.4) and 0.39 and 0.67 miles; the poverty terciles match the existing 10 and 20 breaks almost exactly, the distance terciles do not match any existing band. Share over 1 mile by poverty tier is 18.0%, 14.0%, and 7.2%: the map will show a small target corner, which is the honest finding and agrees with the report's H4.

## Falsification/Refine

- **Claim: Stevens' published palettes work here.** Tested (scratch `bivar.py`, `compare.py`) composited at 0.7 over `#f5f5f5`: pink-blue all-pairs minimum OKLab ΔE×100 is 5.5 normal, 2.0 protan, 1.1 deutan, and 0.4 from the no-data grey; red-teal 5.8 / 2.4 / 3.6; purple-gold 4.5 / 4.7 / 4.4, tritan 1.4. All fail at this opacity. Their blue arms also collide with the blue tinted excluded greys and the `#0288d1` poll dots. **Refuted**; a custom palette is needed.
- **Claim: 9 colors can pass the all-pairs CVD target at 0.7 opacity.** A random search of 60,000 four-corner OKLab bilinear grids (`search3.py`) with warm poverty and purple distance arms tops out at an all-pairs minimum of 8.9 normal, 7.2 protan, 7.5 deutan, 8.6 tritan. Protan and deutan land in the 6 to 8 floor band. At fill opacity 0.85 the same palette reaches 11.3 / 8.9 / 9.7 / 10.8, all above target. **Refined**: raise Combined mode opacity to 0.85 and add a secondary encoding (outline) on the target cell.
- **Claim: client-side classing from numeric `miles` matches Distance mode.** The GeoJSON `miles` is rounded to 0.01 because it is parsed from the KML pop-up text. Classing rounded `miles` with `<` breaks disagrees with the Python `distanceFill` band (computed from exact miles) for **111 pieces** (97 with `<=`). Poverty classing from `povertyPct` agrees for all 7,751. **Refuted** for distance; the combined cell must be computed in Python from the band index, not from rounded miles.
- **Claim: the no-data grey `#b5c3d9` needs separation.** No piece lacks `povertyPct` (0 of 7,751), so no-data never draws on the assignment map. It is excluded from the Combined legend; its closest cell (`#b7afca`) is ΔE 2.9 to 4.1 and would collide if no-data ever appeared.
- **Claim: the dataviz skill validator passes.** Its categorical gates do not fit a bivariate grid: run on the raw 9 colors with `--pairs all`, CVD passes (worst 10.7 protan, tritan 12.7) but the lightness band, chroma floor, and normal-vision floor (13.8 below 15) fail by design, since a bivariate grid spans light to dark and its center is desaturated. The skill itself caps all-pairs forms at 3 categorical series; the mitigations it requires (secondary encoding, a table view) are adopted.
- **Side finding (out of scope):** pop-ups show 2-decimal miles, so a piece reading "0.25 miles" can be colored "Within 1/4 mile". Tracts with poverty between 19.95% and 20.0% round up in pop-ups and in GeoJSON classing.

## Scope

In: a "Combined" radio in the existing mode group; Python emits `combinedCell` and `combinedFill` per piece and a `legends.combined` entry; a 3x3 legend table in the controls card; a white outline on target pieces; a "Only high poverty and far" checkbox that dims the rest; a one-line text summary; pop-up line naming the cell.

Out: changing Poverty or Distance modes' colors or breaks; PMTiles; fixing pop-up rounding; a scatter plot companion; dark mode (the basemap is light only).

## Resolved Decisions

1. **3x3 grid**, rows = poverty, columns = distance. Rejected 4x4+ on [3], the near-empty cells, and the color budget at 0.7 to 0.85 opacity.
2. **Breaks collapse the existing ones** rather than terciles: poverty 10 and 20 percent (Poverty classes 3 to 5 merge to "20% and over", the Census Bureau's poverty area threshold [15] and the report's disparate impact split); distance 1/2 and 1 mile (Distance bands 1 and 2 merge to "Under 1/2 mile"; 1/2 and 1 mile are the H3 and H4 cutoffs). Every combined boundary is a boundary in one of the other two modes.
3. **Palette** is a custom four-corner OKLab bilinear grid: cream, purple (low poverty, far, matching Distance mode's Purples), red-orange (high poverty, near, matching Poverty mode's Reds), deep wine (target). Hex values and numbers are in design.md.
4. **Combined mode fill opacity 0.85**, with fill and outline layers inserted below the basemap's first symbol layer so street labels stay readable.
5. **Secondary encoding**: white 1.5px outline on target pieces; highlight filter; pop-up cell label; legend as a real `<table>`.
6. **Data contract**: computed in Python from `povertyPct` and the exact distance band, not client-side, because of the 111 rounding mismatches.

## Sources

[1] J. Stevens, "Bivariate Choropleth Maps: A How-to Guide," 2015. https://www.joshuastevens.net/cartography/make-a-bivariate-choropleth-map/
[2] B. E. Trumbo, "A Theory for Coloring Bivariate Statistical Maps," *The American Statistician*, vol. 35, no. 4, pp. 220-226, 1981.
[3] H. Wainer and C. M. Francolini, "An Empirical Inquiry Concerning Human Understanding of Two-Variable Color Maps," *The American Statistician*, vol. 34, no. 2, pp. 81-93, 1980. https://www.ets.org/research/policy_research_reports/publications/article/1980/bhko.html
[4] J. M. Olson, "The Organization of Color on Two-Variable Maps," *Proc. Auto-Carto II*, 1975. https://cartogis.org/docs/proceedings/archive/auto-carto-2/pdf/the-organization-of-color-on-two-variable-maps.pdf
[5] J. R. Eyton, "Complementary-Color, Two-Variable Maps," *Annals of the Association of American Geographers*, vol. 74, no. 3, pp. 477-490, 1984.
[6] M. E. Elmer, "Symbol Considerations for Bivariate Thematic Mapping," M.S. thesis, Univ. of Wisconsin-Madison, 2012. https://geography.wisc.edu/cartography/projects/StudentTheses/Elmer_2012_SymbolConsiderationsForBivariateThematicMapping.pdf
[7] A. M. Leonowicz, "One-Variable and Two-Variable Choropleth Maps" (poster abstract), *Proc. 23rd Int. Cartographic Conf.*, Moscow, 2007. https://icaci.org/files/documents/ICC_proceedings/ICC2007/abstracts/html/1_Poster3_6_ONE-VARIABLE%20AND%20TWO-VARIABLE%20CHOROPLETH%20MAPS.htm
[8] G. Strode, Morgan, Thornton, Mesev, Rau, Shortes, and Johnson, "Operationalizing Trumbo's Principles of Bivariate Choropleth Map Design," *Cartographic Perspectives*, no. 94, 2020, doi:10.14714/CP94.1538.
[9] R. E. Roth, A. W. Woodruff, Z. F. Johnson, "Value-by-alpha Maps: An Alternative Technique to the Cartogram," *The Cartographic Journal*, vol. 47, no. 2, pp. 130-140, 2010. https://geography.wisc.edu/cartography/projects/publications/RothEtAl_2010_CJ.pdf
[10] D. P. Retchless and C. A. Brewer, "Guidance for Representing Uncertainty on Global Temperature Change Maps," *International Journal of Climatology*, vol. 36, no. 3, 2016. https://pure.psu.edu/en/publications/guidance-for-representing-uncertainty-on-global-temperature-chang/
[11] A. J. Teuling, R. Stöckli, S. I. Seneviratne, "Bivariate Colour Maps for Visualizing Climate Data," *International Journal of Climatology*, vol. 31, no. 9, 2011, doi:10.1002/joc.2153.
[12] C. A. Brewer, "Color Use Guidelines for Mapping and Visualization," in *Visualization in Modern Cartography*, A. M. MacEachren and D. R. F. Taylor, Eds. Oxford: Pergamon, 1994, pp. 123-147.
[13] C. A. Brewer and T. A. Suchan, *Mapping Census 2000: The Geography of U.S. Diversity*, U.S. Census Bureau, CENSR/01-1, 2001.
[14] G. M. Machado, M. M. Oliveira, L. A. F. Fernandes, "A Physiologically-based Model for Simulation of Color Vision Deficiency," *IEEE TVCG*, vol. 15, no. 6, pp. 1291-1298, 2009, doi:10.1109/TVCG.2009.113.
[15] U.S. Census Bureau, "Areas With Concentrated Poverty: 2006-2010," ACSBR/10-17, 2011. https://www.census.gov/library/publications/2011/acs/acsbr10-17.html
[16] Observable, "Bivariate choropleth" (D3 example, Stevens colors). https://observablehq.com/notebook-kit/ex/d3/bivariate-choropleth
[17] L. C. Muth, "The gender income gap, squared," Datawrapper blog. https://blog.datawrapper.de/bivariate-map-scatter-plot
[18] A. Brychtová, "Color distance and legend position," Palacký University eye-tracking lab, CARTOCON 2014. https://eyetracking.upol.cz/color-distance-and-legend-position/
[19] B. Ottosson, "A perceptual color space for image processing," 2020. https://bottosson.github.io/posts/oklab/
[20] G. Sharma, W. Wu, E. N. Dalal, "The CIEDE2000 Color-Difference Formula," *Color Research and Application*, vol. 30, no. 1, pp. 21-30, 2005.
