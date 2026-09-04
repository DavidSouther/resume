#import "@preview/lilaq:0.6.0" as lq

#let blue = rgb("#2563eb")
#let orange = rgb("#d97706")
#let green = rgb("#15803d")
#let violet = rgb("#7c3aed")
#let ink = rgb("#1f2937")

#let k = 60.0
#let b = 1.0
#let ranks = lq.linspace(1, 1000, num: 120)
#let supports = (1.0, 2.0, 3.0, 4.0, 5.0)
#let rrf-term(r) = 1.0 / (k + r)
#let coverage-multiplier(c) = calc.ln(c + b) / calc.ln(1 + b)
#let same-rank-boost(c) = c * coverage-multiplier(c)
// A singleton at rank 1 ties c equal-rank supports at this rank.
#let tie-depth(c) = c * coverage-multiplier(c) * (k + 1) - k

#let rank-panel = lq.diagram(
  width: 5.0cm, height: 5.4cm,
  xlabel: [rank in one list (log scale)], ylabel: [one list's contribution],
  xlim: (1, 1000), ylim: (0, 0.017),
  xaxis: (scale: "log", ticks: ((1, [1]), (10, [10]), (100, [100]), (1000, [1000]))),
  yaxis: (ticks: ((0.001, [0.001]), (0.01, [0.010]), (0.016, [0.016]))),
  grid: (stroke: 0.25pt + luma(220)),
  lq.plot(ranks, ranks.map(rrf-term), color: blue, stroke: 1.5pt + blue, mark: none),
  lq.scatter((1.0, 10.0, 100.0, 500.0), (1.0, 10.0, 100.0, 500.0).map(rrf-term), color: orange, size: 4pt),
)

#let coverage-panel = lq.diagram(
  width: 4.7cm, height: 5.4cm,
  xlabel: [lists containing the candidate], ylabel: [score relative to one list],
  xlim: (0.75, 5.3), ylim: (0, 14),
  xaxis: (ticks: supports), yaxis: (ticks: ((1, [1]), (5, [5]), (10, [10]), (13, [13]))),
  grid: (stroke: 0.25pt + luma(220)),
  legend: (position: top + left),
  lq.plot(supports, supports, label: [plain RRF: add the votes], color: orange, stroke: (paint: orange, thickness: 1.2pt, dash: "dashed"), mark: "o", mark-size: 3pt),
  lq.plot(supports, supports.map(same-rank-boost), label: [log RRF: add, then boost], color: green, stroke: 1.5pt + green, mark: "o", mark-size: 3.5pt),
)

#let equivalence-panel = lq.diagram(
  width: 5.0cm, height: 5.4cm,
  xlabel: [lists containing the candidate], ylabel: [deepest shared rank that ties rank 1],
  xlim: (0.75, 5.3), ylim: (0, 800),
  xaxis: (ticks: supports), yaxis: (ticks: ((0, [0]), (133, [133]), (306, [306]), (728, [728]))),
  grid: (stroke: 0.25pt + luma(220)),
  lq.plot(supports, supports.map(tie-depth), color: violet, stroke: 1.5pt + violet, mark: "o", mark-size: 3.5pt),
  ..supports.map(c => lq.place(c, tie-depth(c) + 45, text(size: 7pt, fill: violet)[#calc.round(tie-depth(c))])),
)

#let default-parameter-intuition-figure() = block(width: 100%)[
  #text(size: 8pt, weight: "bold")[Default behavior at $k=60$, $b=1$: add rank evidence, then reward agreement again]
  #text(size: 7pt)[Every retrieval list casts a rank-weighted vote. Plain RRF adds those votes. Log RRF adds them, then multiplies the result by $log_2(|R_d|+1)$.]
  #v(3pt)
  #grid(columns: (5cm, 4.7cm, 5cm), column-gutter: 0.45cm, rank-panel, coverage-panel, equivalence-panel)
  #v(2pt)
  #align(center, text(size: 7pt)[Read left to right. A candidate at ranks $(5, 100, 500)$ receives three votes totaling $1/65 + 1/160 + 1/560 = 0.0234$. Because it appears in three lists, log RRF doubles that sum to $0.0468$. A candidate appearing once at rank 1 scores $1/61 = 0.0164$, so the mixed-rank candidate wins by about $2.85 times$. The right panel is the equal-rank shortcut: five rank-728 appearances tie one rank-1 appearance.])
]
