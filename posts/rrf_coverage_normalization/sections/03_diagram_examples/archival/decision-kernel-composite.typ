#import "@preview/lilaq:0.6.0" as lq

#let blue = rgb("#2563eb")
#let orange = rgb("#d97706")
#let green = rgb("#15803d")
#let violet = rgb("#7c3aed")

// A ranks once at rank 1. B has c equal-rank supporters at rank r. The
// threshold below gives the largest r for which B ties or beats A.
#let rrf-threshold(k, c) = (c - 1) * k + c
#let log-multiplier(c, b) = calc.ln(c + b) / calc.ln(1 + b)
#let log-threshold(k, c, b) = (c * log-multiplier(c, b) - 1) * k + c * log-multiplier(c, b)

#let k-values = lq.linspace(0, 200, num: 80)
#let coverage-levels = (2.0, 3.0, 5.0)

#let threshold-panel = lq.diagram(
  width: 8.2cm, height: 6.5cm, xlabel: [$k$], ylabel: [B's tie rank $r$],
  xlim: (0, 200), ylim: (0, 2600), xaxis: (ticks: (0, 20, 60, 100, 200)),
  yaxis: (ticks: (0, 500, 1500, 2500)), grid: (stroke: 0.25pt + luma(220)),
  legend: (position: top + left),
  ..coverage-levels.enumerate().map(entry => {
    let c = entry.at(1)
    let color = (blue, green, violet).at(entry.at(0))
    lq.plot(k-values, k-values.map(k => rrf-threshold(k, c)), label: [$"RRF, " #c " supporters"$], color: color, stroke: (paint: color, thickness: 1.1pt, dash: "dashed"), mark: none)
  }),
  ..coverage-levels.enumerate().map(entry => {
    let c = entry.at(1)
    let color = (blue, green, violet).at(entry.at(0))
    lq.plot(k-values, k-values.map(k => log-threshold(k, c, 1.0)), label: [$"log RRF, " #c " supporters"$], color: color, stroke: 1.4pt + color, mark: none)
  }),
)

#let b-panel = lq.diagram(
  width: 6.1cm, height: 6.5cm, xlabel: [$k$], ylabel: [extra tie-rank depth over RRF],
  xlim: (0, 200), ylim: (0, 3300), xaxis: (ticks: (0, 20, 60, 100, 200)),
  yaxis: (ticks: (0, 1000, 2000, 3000)), grid: (stroke: 0.25pt + luma(220)),
  legend: (position: top + left),
  ..((0.5, orange), (1.0, blue), (4.0, green)).map(entry => {
    let b = entry.at(0)
    let color = entry.at(1)
    lq.plot(k-values, k-values.map(k => log-threshold(k, 5.0, b) - rrf-threshold(k, 5.0)), label: [$b=#b$], color: color, stroke: 1.35pt + color, mark: none)
  }),
)

#let decision-kernel-composite-figure() = block(width: 100%)[
  #text(size: 8pt, weight: "bold")[Where logarithmic RRF diverges from plain RRF]
  #text(size: 7pt)[A is a singleton at rank 1. B has equal-rank support. Solid lines are singleton-normalized log RRF with $b=1$; dashed lines are plain RRF.]
  #v(3pt)
  #grid(columns: (8.2cm, 6.1cm), column-gutter: 0.55cm, threshold-panel, b-panel)
  #v(2pt)
  #align(center, text(size: 7pt)[For equal-rank support $c$, the tie threshold is $r = (c-1)k+c$ under RRF and $r = (c ln(c+b) / ln(1+b)-1)k + c ln(c+b) / ln(1+b)$ under log RRF. Their difference grows linearly with $k$: they are closest near $k=0$ and separate most at large $k$. Smaller $b$ makes the separation steeper.])
]
