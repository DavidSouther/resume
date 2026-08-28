#import "@preview/lilaq:0.6.0" as lq

#let blue = rgb("#2563eb")
#let orange = rgb("#d97706")
#let green = rgb("#15803d")
#let violet = rgb("#7c3aed")
#let ink = rgb("#1f2937")
#let grey = rgb("#64748b")

// Each row is one candidate's ranks across distinct input lists. The plotted
// value is its singleton-normalized log-RRF score divided by the score of (1).
#let ratios = (2.077, 1.095, 2.288, 0.777, 1.209, 0.381, 1.0)
#let rows = (1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0)
#let fills = (violet, green, green, blue, blue, grey, ink)
#let ratio-labels = ([2.08×], [1.10×], [2.29×], [0.78×], [1.21×], [0.38×], [1.00×])

#let profile-chart = lq.diagram(
  width: 14.5cm,
  height: 7.4cm,
  xlabel: [log-RRF score relative to one rank-1 appearance],
  xlim: (0, 2.55),
  ylim: (0.45, 7.55),
  xaxis: (ticks: ((0, [0]), (0.5, [0.5]), (1, [1.0]), (1.5, [1.5]), (2, [2.0]), (2.5, [2.5]))),
  yaxis: (
    ticks: (
      (1, [5 lists: ranks 100, 300, 500, 700, 900]),
      (2, [3 lists: ranks 100, 500, 1000]),
      (3, [3 lists: ranks 100, 100, 100]),
      (4, [2 lists: ranks 100, 500]),
      (5, [2 lists: ranks 100, 100]),
      (6, [1 list: rank 100]),
      (7, [1 list: rank 1 (baseline)]),
    ),
    subticks: none,
  ),
  grid: (stroke: 0.25pt + luma(225)),
  lq.hbar(ratios, rows, fill: fills, width: 58%),
  lq.line((1, 0.5), (1, 7.5), stroke: (paint: orange, thickness: 1.2pt, dash: "dashed")),
  ..ratios.enumerate().map(entry => {
    let index = entry.at(0)
    let value = entry.at(1)
    lq.place(value + 0.035, rows.at(index), align: left, text(size: 7pt, weight: "bold", fill: fills.at(index))[#ratio-labels.at(index)])
  }),
)

#let rank-profile-comparison-figure() = block(width: 100%)[
  #text(size: 8pt, weight: "bold")[What a mid-ranked match means depends on the rest of its rank profile]
  #text(size: 7pt)[Each row is one candidate's positions across distinct retrieval lists at $k=60$, $b=1$. The dashed line is a pairwise tie with a candidate that appears once at rank 1.]
  #v(3pt)
  #profile-chart
  #v(2pt)
  #align(center, text(size: 7pt)[Rank 100 alone is weak. Two rank-100 appearances reinforce each other enough to cross the line, but ranks $(100, 500)$ do not. A third appearance at rank 1000 makes $(100, 500, 1000)$ only narrowly competitive; three consistently strong appearances win by much more.])
]
