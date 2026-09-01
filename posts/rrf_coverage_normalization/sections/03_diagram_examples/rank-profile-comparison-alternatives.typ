#import "@preview/lilaq:0.6.0" as lq

#let blue = rgb("#2563eb")
#let orange = rgb("#d97706")
#let green = rgb("#15803d")
#let violet = rgb("#7c3aed")
#let ink = rgb("#1f2937")
#let grey = rgb("#64748b")

#let rows = (1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0)
#let fills = (violet, green, green, blue, blue, grey, ink)
#let profile-ticks = (
  (1, [5 retrievers, ranks 100, 300, 500, 700, 900]),
  (2, [3 retrievers, ranks 100, 500, 1000]),
  (3, [3 retrievers, ranks 100, 100, 100]),
  (4, [2 retrievers, ranks 100, 500]),
  (5, [2 retrievers, ranks 100, 100]),
  (6, [1 retriever, rank 100]),
  (7, [1 retriever, rank 1]),
)

#let comparison-chart(
  values,
  labels,
  xmin,
  ticks,
  xlabel,
  label-offset,
  zero-singletons: false,
) = lq.diagram(
  width: 14.5cm,
  height: 7.4cm,
  xlabel: xlabel,
  xlim: (xmin, 0.45),
  ylim: (0.45, 7.55),
  xaxis: (ticks: ticks),
  yaxis: (ticks: profile-ticks, subticks: none),
  grid: (stroke: 0.25pt + luma(225)),
  lq.hbar(
    if zero-singletons { values.slice(0, 5) } else { values },
    if zero-singletons { rows.slice(0, 5) } else { rows },
    fill: if zero-singletons { fills.slice(0, 5) } else { fills },
    width: 58%,
    base: 0,
  ),
  lq.line((0, 0.5), (0, 7.5), stroke: (paint: orange, thickness: 1.2pt, dash: "dashed")),
  ..values.slice(0, if zero-singletons { 5 } else { values.len() }).enumerate().map(entry => {
    let index = entry.at(0)
    let value = entry.at(1)
    lq.place(value + label-offset, rows.at(index), align: left, text(size: 7pt, weight: "bold", fill: if value == 0 { ink } else { white })[#labels.at(index)])
  }),
  if zero-singletons {
    lq.place(xmin + label-offset, 6, align: left, text(size: 7pt, weight: "bold", fill: grey)[score = 0])
  },
  if zero-singletons {
    lq.place(xmin + label-offset, 7, align: left, text(size: 7pt, weight: "bold", fill: ink)[score = 0])
  },
)

// RBC ratios to one rank-1 appearance at phi = 0.7, shown as log10 ratios.
#let rbc-values = (-15.3353, -15.3353, -14.8582, -15.3353, -15.0343, -15.3353, 0.0)
#let rbc-labels = ([4.62e−16×], [4.62e−16×], [1.39e−15×], [4.62e−16×], [9.24e−16×], [4.62e−16×], [1.00×])
#let rbc-chart = comparison-chart(
  rbc-values,
  rbc-labels,
  -16.5,
  ((-16, [−16]), (-12, [−12]), (-8, [−8]), (-4, [−4]), (0, [0])),
  [$log_10(S_(upright("RBC")) slash S_(upright("RBC"))(1))$; farther left is weaker],
  0.24,
)

// ISR ratios to one rank-1 appearance, shown as log10 ratios.
#let isr-values = (-3.2277, -3.5017, -3.0458, -3.6819, -3.3979, -4.0, 0.0)
#let isr-labels = ([5.92e−4×], [3.15e−4×], [9.00e−4×], [2.08e−4×], [4.00e−4×], [1.00e−4×], [1.00×])
#let isr-chart = comparison-chart(
  isr-values,
  isr-labels,
  -4.5,
  ((-4, [−4]), (-3, [−3]), (-2, [−2]), (-1, [−1]), (0, [0])),
  [$log_10(S_(upright("ISR")) slash S_(upright("ISR"))(1))$; farther left is weaker],
  0.08,
)

// A rank-1 singleton has logISR score zero, so no singleton-normalized ratio
// exists. Multi-support profiles are instead compared with ranks (1, 1).
#let log-isr-values = (-3.8619, -4.0798, -3.6239, -4.2840, -4.0, 0.0, 0.0)
#let log-isr-labels = ([1.37e−4×], [8.32e−5×], [2.38e−4×], [5.20e−5×], [1.00e−4×], [], [])
#let log-isr-chart = comparison-chart(
  log-isr-values,
  log-isr-labels,
  -4.8,
  ((-4, [−4]), (-3, [−3]), (-2, [−2]), (-1, [−1]), (0, [0])),
  [$log_10(S_(upright("logISR")) slash S_(upright("logISR"))(1,1))$; farther left is weaker],
  0.09,
  zero-singletons: true,
)

#let rbc-rank-profile-figure() = block(width: 100%)[
  #text(size: 8pt, weight: "bold")[Rank-Biased Centroid at $phi=0.7$: rank 100 is already fifteen orders below rank 1]
  #text(size: 7pt)[The rows match Figure 12. Values are logarithms of score ratios, so the dashed line at zero is a tie with one rank-1 appearance and every bar extending left loses.]
  #v(3pt)
  #rbc-chart
  #v(2pt)
  #align(center, text(size: 7pt)[The geometric kernel makes the rank-100 term dominate every mixed profile shown; ranks 300--1000 add effectively nothing at this persistence. Coverage changes a tiny score by a small integer factor, not enough to approach the rank-1 baseline.])
]

#let isr-rank-profile-figure() = block(width: 100%)[
  #text(size: 8pt, weight: "bold")[ISR: coverage helps, but inverse-square decay keeps these profiles far below rank 1]
  #text(size: 7pt)[The rows again match Figure 12. The dashed line is a tie with one rank-1 appearance; the horizontal scale is the base-10 logarithm of that score ratio.]
  #v(3pt)
  #isr-chart
  #v(2pt)
  #align(center, text(size: 7pt)[Three rank-100 appearances are the strongest mid-rank profile at $9.00 times 10^(-4)$ of the baseline. Five broader appearances beat the two-support profiles, but remain about 1,700 times weaker than the rank-1 singleton.])
]

#let log-isr-rank-profile-figure() = block(width: 100%)[
  #text(size: 8pt, weight: "bold")[logISR: every singleton is erased, then inverse-square rank quality dominates]
  #text(size: 7pt)[Because $ln(1)=0$, neither singleton can serve as a nonzero baseline. Multi-support rows are therefore compared with two rank-1 appearances; the dashed line is that tie.]
  #v(3pt)
  #log-isr-chart
  #v(2pt)
  #align(center, text(size: 7pt)[Every multi-support profile beats every singleton's zero score, regardless of rank. Among candidates with two or more supports, however, the inverse-square terms still make these mid-to-deep profiles roughly four orders of magnitude weaker than ranks $(1,1)$.])
]
